/**
 * Kiểm thử tích hợp Phase 0 — chạy trên Postgres THẬT, không mock database.
 *
 * Cần DATABASE_URL trỏ tới một database dùng riêng cho test. Không có thì bỏ qua
 * chứ không giả vờ pass.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { and, eq, like, sql } from "drizzle-orm";
import { taoDb, type Db } from "./client.ts";
import { chayMigrations } from "./migrate.ts";
import { seed } from "./seed.ts";
import {
  auditLog,
  configSettings,
  domainEvents,
  inventoryLocations,
  roles,
  stores,
  userRoles,
  users,
} from "./schema/index.ts";
import { ghiAudit, chiTruongDoi } from "./audit.ts";
import { loadPrincipal } from "@aescentic/auth";
import { authorize, canTouchStore, requirePermission } from "@aescentic/permissions";
import { datCauHinh, docCauHinh, docCauHinhMacDinh } from "@aescentic/config";
import { danhDauDaXuLy, layEventChuaXuLy, phatSuKien } from "@aescentic/events";
import { MockPosProvider } from "@aescentic/integrations";

const URL = process.env.DATABASE_URL;
let db: Db;

// Bộ test này bỏ qua khi không có DATABASE_URL. Im lặng bỏ qua là nguy hiểm —
// CI sẽ xanh mà chẳng kiểm gì. Nên hét lên cho người chạy biết.
if (!URL) {
  console.warn(
    "\n⚠  BỎ QUA 22 test tích hợp: chưa đặt DATABASE_URL.\n" +
      "   Chúng chỉ chạy trên PostgreSQL thật. Xem aescentic-os/README.md.\n",
  );
}

describe("Phase 0 foundation", { skip: URL ? false : "Chưa đặt DATABASE_URL" }, () => {
  before(async () => {
    await chayMigrations(URL);
    db = taoDb(URL);
    await seed(db);
    // Bộ test phải chạy lại được nhiều lần trên cùng database: dọn sạch dấu vết
    // của lần chạy trước, nếu không lần thứ hai sẽ đỏ vì dữ liệu tồn đọng.
    await db.delete(configSettings).where(like(configSettings.key, "test.%"));
    await db.delete(auditLog).where(eq(auditLog.entityId, "sku-test"));
    await db.delete(domainEvents).where(eq(domainEvents.entityId, "AES-001-50"));
  });

  after(async () => {
    await db.$sql.end({ timeout: 5 });
  });

  test("migration chạy lại không tạo thay đổi", async () => {
    const kq = await chayMigrations(URL);
    assert.equal(kq.daChay.length, 0);
    assert.equal(kq.canhBao.length, 0, kq.canhBao.join(" | "));
  });

  test("seed chạy lại không nhân đôi dữ liệu", async () => {
    const truoc = await db.select({ n: sql<number>`count(*)::int` }).from(stores);
    await seed(db);
    const sau = await db.select({ n: sql<number>`count(*)::int` }).from(stores);
    assert.equal(sau[0]!.n, truoc[0]!.n);
  });

  test("kho hàng bán theo đúng luật ai quản — chốt chặn rủi ro R1", async () => {
    // Luật nằm ở `os.kho_ban_do_ai_quan()` (migration 0004), không phải hằng số
    // chép tay ở nhiều nơi. Test hỏi cùng một nguồn mà seed hỏi.
    const [luat] = await db.execute<{ kho_ban_do_ai_quan: string }>(
      sql`select os.kho_ban_do_ai_quan()`,
    );
    const phaiLa = luat!.kho_ban_do_ai_quan;
    assert.ok(phaiLa === "os" || phaiLa === "nhanh");

    const banHang = await db
      .select({ code: inventoryLocations.code, managedBy: inventoryLocations.managedBy })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.kind, "sellable"));

    assert.ok(banHang.length > 0);
    for (const l of banHang) {
      assert.equal(l.managedBy, phaiLa, `${l.code} sai chủ quản`);
    }

    const tester = await db
      .select({ managedBy: inventoryLocations.managedBy })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.kind, "tester"));
    for (const l of tester) assert.equal(l.managedBy, "os");
  });

  test("Nhanh.vn đồng bộ thành công lần đầu thì kho bán tự đổi chủ và OS bị chặn ghi", async () => {
    // Chạy trong transaction rồi rollback: không được để lại di chứng cho các
    // test sau, vì nó lật chủ quản của toàn bộ kho hàng bán.
    await db
      .transaction(async (tx) => {
        await tx.execute(sql`
          insert into os.integration_sync_state (provider, resource)
          values ('nhanh', 'test_doi_chu')
          on conflict (provider, resource) do nothing`);
        await tx.execute(sql`
          update os.integration_sync_state set last_success_at = now()
          where provider = 'nhanh' and resource = 'test_doi_chu'`);

        const sau = await tx
          .select({ managedBy: inventoryLocations.managedBy })
          .from(inventoryLocations)
          .where(eq(inventoryLocations.kind, "sellable"));
        assert.ok(sau.length > 0);
        for (const l of sau) assert.equal(l.managedBy, "nhanh", "phải tự chuyển sang Nhanh.vn");

        const [ghi] = await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from os.audit_log
          where event = 'inventory.ownership_changed'`);
        assert.ok((ghi?.n ?? 0) > 0, "phải ghi nhật ký khi đổi chủ kho");

        // Từ giờ OS ghi tồn vào kho bán là bị chặn.
        const [dd] = await tx
          .select({ id: inventoryLocations.id })
          .from(inventoryLocations)
          .where(eq(inventoryLocations.kind, "sellable"))
          .limit(1);
        const [s] = await tx.execute<{ id: string }>(sql`select id from os.skus limit 1`);
        await assert.rejects(
          () =>
            tx.execute(
              sql`select os.fn_apply_stock_move(${s!.id}::uuid, ${dd!.id}::uuid, 5, 'receipt', null, null, null)`,
            ),
          /Nhanh\.vn quản/,
        );

        throw new Error("ROLLBACK_CO_Y");
      })
      .catch((e: Error) => {
        if (e.message !== "ROLLBACK_CO_Y") throw e;
      });

    // Đã rollback: mọi thứ trở lại như cũ.
    const [luat] = await db.execute<{ kho_ban_do_ai_quan: string }>(
      sql`select os.kho_ban_do_ai_quan()`,
    );
    const conLai = await db
      .select({ managedBy: inventoryLocations.managedBy })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.kind, "sellable"));
    for (const l of conLai) assert.equal(l.managedBy, luat!.kho_ban_do_ai_quan);
  });

  describe("RBAC với dữ liệu thật", () => {
    async function principalTheoEmail(email: string) {
      const [u] = await db.select().from(users).where(eq(users.email, email));
      assert.ok(u, `không thấy user ${email}`);
      const p = await loadPrincipal(db, u.id);
      assert.ok(p, `không dựng được principal cho ${email}`);
      return p;
    }

    test("nhân viên bán lẻ chỉ xem được lương của chính mình", async () => {
      const p = await principalTheoEmail("nv1.dk@aescentic.vn");

      const tuMinh = authorize(p, "payroll.read");
      assert.equal(tuMinh.allowed, true);
      assert.equal(tuMinh.allowed && tuMinh.scope, "self");

      const duyet = authorize(p, "payroll.approve");
      assert.equal(duyet.allowed, false);
    });

    test("nhân viên bán lẻ không xem được giá vốn", async () => {
      const p = await principalTheoEmail("nv1.dk@aescentic.vn");
      assert.equal(authorize(p, "product.cost").allowed, false);
    });

    test("quản lý cửa hàng A không đụng được tồn kho cửa hàng B", async () => {
      const p = await principalTheoEmail("ql.dk@aescentic.vn");
      const d = authorize(p, "inventory.adjust");
      assert.equal(d.allowed, true);
      assert.equal(d.allowed && d.scope, "store");

      const [dongKhoi] = await db.select().from(stores).where(eq(stores.code, "CH-DK"));
      const [thaoDien] = await db.select().from(stores).where(eq(stores.code, "CH-TD"));

      assert.equal(canTouchStore(d, dongKhoi!.id), true, "phải sửa được cửa hàng mình");
      assert.equal(canTouchStore(d, thaoDien!.id), false, "không được đụng cửa hàng khác");
    });

    test("CEO có toàn quyền", async () => {
      const p = await principalTheoEmail("jen@aescentic.vn");
      for (const q of ["payroll.approve", "product.cost", "audit.read", "config.manage"]) {
        assert.equal(authorize(p, q).allowed, true, `CEO phải được ${q}`);
      }
      const [ch] = await db.select().from(stores).limit(1);
      assert.equal(canTouchStore(authorize(p, "inventory.adjust"), ch!.id), true);
    });

    test("kế toán xem được giá vốn nhưng không xếp được ca", async () => {
      const p = await principalTheoEmail("ketoan@aescentic.vn");
      assert.equal(authorize(p, "product.cost").allowed, true);
      assert.equal(authorize(p, "schedule.manage").allowed, false);
    });

    test("tài khoản bị vô hiệu hoá thì không dựng được principal", async () => {
      const [u] = await db.select().from(users).where(eq(users.email, "nv2.dk@aescentic.vn"));
      await db.update(users).set({ isActive: false }).where(eq(users.id, u!.id));
      assert.equal(await loadPrincipal(db, u!.id), null);
      await db.update(users).set({ isActive: true }).where(eq(users.id, u!.id));
    });

    test("gỡ vai trò thì mất quyền ngay lần dựng principal sau", async () => {
      const [u] = await db.select().from(users).where(eq(users.email, "kho@aescentic.vn"));
      const [vt] = await db.select().from(roles).where(eq(roles.code, "warehouse"));

      assert.equal(authorize((await loadPrincipal(db, u!.id))!, "inventory.adjust").allowed, true);

      await db
        .delete(userRoles)
        .where(and(eq(userRoles.userId, u!.id), eq(userRoles.roleId, vt!.id)));

      assert.equal(authorize((await loadPrincipal(db, u!.id))!, "inventory.adjust").allowed, false);

      await db.insert(userRoles).values({ userId: u!.id, roleId: vt!.id });
    });
  });

  describe("cấu hình có phiên bản theo thời gian", () => {
    const KEY = "test.commission_rate";

    test("đọc giá trị đúng theo mốc thời gian", async () => {
      const thang1 = new Date("2026-01-01T00:00:00Z");
      const thang6 = new Date("2026-06-01T00:00:00Z");

      await datCauHinh(db, { key: KEY, value: 3, effectiveFrom: thang1 });
      await datCauHinh(db, { key: KEY, value: 5, effectiveFrom: thang6 });

      assert.equal(
        await docCauHinh<number>(db, { key: KEY, at: new Date("2026-03-15T00:00:00Z") }),
        3,
        "kỳ lương tháng 3 phải dùng tỷ lệ có hiệu lực tháng 3, không phải tỷ lệ mới nhất",
      );
      assert.equal(
        await docCauHinh<number>(db, { key: KEY, at: new Date("2026-08-15T00:00:00Z") }),
        5,
      );
      assert.equal(
        await docCauHinh<number>(db, { key: KEY, at: new Date("2025-12-01T00:00:00Z") }),
        null,
        "trước khi có hiệu lực thì không có giá trị",
      );
    });

    test("đặt giá trị mới đóng bản cũ chứ không xoá", async () => {
      const ls = await db.select().from(configSettings).where(eq(configSettings.key, KEY));
      assert.equal(ls.length, 2, "phải giữ đủ lịch sử");
      assert.equal(ls.filter((r) => r.effectiveTo === null).length, 1, "chỉ 1 bản đang hiệu lực");
    });

    test("cấu hình riêng cửa hàng thắng cấu hình chung", async () => {
      const [ch] = await db.select().from(stores).where(eq(stores.code, "CH-DK"));
      const key = "test.target";
      await datCauHinh(db, { key, value: 100 });
      await datCauHinh(db, { key, value: 250, scopeType: "store", scopeId: ch!.id });

      assert.equal(await docCauHinh<number>(db, { key }), 100);
      assert.equal(
        await docCauHinh<number>(db, { key, scopeType: "store", scopeId: ch!.id }),
        250,
      );
    });

    test("không có cấu hình thì dùng giá trị mặc định", async () => {
      assert.equal(
        await docCauHinhMacDinh(db, { key: "test.khong-ton-tai" }, 42),
        42,
      );
    });

    test("cấu hình seed đọc được", async () => {
      assert.equal(await docCauHinh<string>(db, { key: "b2b.commission_trigger" }), "collected");
    });
  });

  describe("audit", () => {
    test("ghi và đọc lại được", async () => {
      const [u] = await db.select().from(users).where(eq(users.email, "jen@aescentic.vn"));
      await ghiAudit(db, {
        actorUserId: u!.id,
        event: "inventory.adjusted",
        entityType: "sku",
        entityId: "sku-test",
        previousValue: { qty: 10 },
        newValue: { qty: 7 },
        reason: "Kiểm kho",
      });

      const [row] = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityType, "sku"), eq(auditLog.entityId, "sku-test")));

      assert.equal(row!.event, "inventory.adjusted");
      assert.deepEqual(row!.previousValue, { qty: 10 });
      assert.equal(row!.reason, "Kiểm kho");
    });

    test("chỉ ghi trường thực sự đổi", () => {
      const kq = chiTruongDoi(
        { ten: "A", gia: 100, ghiChu: "x" },
        { ten: "A", gia: 120 },
      );
      assert.deepEqual(kq.newValue, { gia: 120 });
      assert.deepEqual(kq.previousValue, { gia: 100 });
      assert.equal(kq.coDoi, true);
    });

    test("không đổi gì thì báo không đổi", () => {
      assert.equal(chiTruongDoi({ a: 1 }, { a: 1 }).coDoi, false);
    });
  });

  describe("domain event outbox", () => {
    test("phát rồi lấy ra xử lý được", async () => {
      await phatSuKien(db, {
        name: "INVENTORY_LOW",
        payload: { skuCode: "AES-001-50", remaining: 2 },
        entityType: "sku",
        entityId: "AES-001-50",
      });

      // Lấy cả hàng chờ chứ không phải 50 cái đầu: bán hàng đẩy event vào đây
      // liên tục mà chưa có worker nào rút ra, nên cửa sổ 50 không còn chứa cái
      // vừa phát. Test phải kiểm đúng hợp đồng của hàm, không kiểm may rủi.
      const chuaXuLy = await layEventChuaXuLy(db, 100_000);
      const cua_ta = chuaXuLy.find((e) => e.entityId === "AES-001-50");
      assert.ok(cua_ta, "event vừa phát phải nằm trong hàng chờ");
      assert.ok(
        chuaXuLy.every((e) => e.processedAt === null),
        "hàng chờ không được lẫn event đã xử lý",
      );
      const thoiGian = chuaXuLy.map((e) => e.occurredAt.getTime());
      assert.deepEqual(thoiGian, [...thoiGian].sort((a, b) => a - b), "phải cũ trước mới sau");

      await danhDauDaXuLy(db, cua_ta.id);
      const [sau] = await db.select().from(domainEvents).where(eq(domainEvents.id, cua_ta.id));
      assert.ok(sau!.processedAt, "phải được đánh dấu đã xử lý");
    });
  });

  describe("POS giả lập", () => {
    test("phân trang trả về đủ, không lặp, không thiếu", async () => {
      const pos = new MockPosProvider();
      const tatCa: string[] = [];
      let cursor: string | null = null;
      let vong = 0;

      do {
        const page = await pos.laySku(cursor);
        tatCa.push(...page.items.map((s) => s.code));
        cursor = page.cursor;
        if (++vong > 100) throw new Error("phân trang không dừng");
      } while (cursor);

      assert.equal(tatCa.length, 60, "30 sản phẩm × 2 dung tích");
      assert.equal(new Set(tatCa).size, 60, "không được trùng giữa các trang");
    });

    test("báo rõ đang chạy chế độ giả lập", async () => {
      const kq = await new MockPosProvider().kiemTraKetNoi();
      assert.equal(kq.ok, true);
      assert.match(kq.message, /giả lập|NHANH_ACCESS_TOKEN/);
    });
  });

  test("không vai trò nào được cấp quyền chồng mà thiếu quyền nền", async () => {
    // `product.cost` là quyền CHỒNG LÊN `product.read`: cấp cái sau mà quên cái
    // trước thì màn hình sản phẩm đóng, và quyền xem giá vốn thành vô dụng —
    // im lặng, không báo lỗi, người dùng chỉ thấy "không đủ quyền".
    const CHONG: [string, string, string][] = [
      ["product", "cost", "read"],
      ["inventory", "adjust", "read"],
      ["inventory", "transfer", "read"],
      ["order", "manage", "read"],
      ["customer", "manage", "read"],
    ];

    const thieu: string[] = [];
    for (const [taiNguyen, hanhDongChong, hanhDongNen] of CHONG) {
      const rows = await db.execute<{ code: string }>(sql`
        select r.code from os.roles r
        where exists (
          select 1 from os.role_permissions rp
          join os.permissions p on p.id = rp.permission_id
          where rp.role_id = r.id and p.resource = ${taiNguyen} and p.action = ${hanhDongChong})
        and not exists (
          select 1 from os.role_permissions rp
          join os.permissions p on p.id = rp.permission_id
          where rp.role_id = r.id and p.resource = ${taiNguyen} and p.action = ${hanhDongNen})`);
      for (const r of rows) {
        thieu.push(`${r.code}: có ${taiNguyen}.${hanhDongChong} nhưng thiếu ${taiNguyen}.${hanhDongNen}`);
      }
    }

    assert.deepEqual(thieu, [], thieu.join(" | "));
  });

  test("requirePermission ném lỗi cho người không có quyền", async () => {
    const [u] = await db.select().from(users).where(eq(users.email, "nv1.dk@aescentic.vn"));
    const p = (await loadPrincipal(db, u!.id))!;
    assert.throws(() => requirePermission(p, "payroll.approve"), /Không có quyền/);
  });
});
