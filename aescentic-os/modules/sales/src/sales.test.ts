/**
 * Kiểm thử nghiệp vụ bán hàng và kho — trên PostgreSQL thật.
 *
 * Trọng tâm là những chỗ mất tiền nếu sai: trừ kho, giá vốn, phạm vi dữ liệu
 * theo cửa hàng, và luật chuyển trạng thái đơn.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { and, desc, eq, like, sql } from "drizzle-orm";
import {
  auditLog,
  chayMigrations,
  domainEvents,
  inventoryBalances,
  inventoryLocations,
  orderLines,
  orders,
  skus,
  stores,
  taoDb,
  users,
  type Db,
} from "@aescentic/database";
import { seed } from "@aescentic/database/seed.ts";
import { loadPrincipal } from "@aescentic/auth";
import type { Principal } from "@aescentic/permissions";
import {
  chiTietDon,
  chotDoiSoatCod,
  danhSachDon,
  doanhThuTheoKenh,
  doiTrangThai,
  donCodChuaDoiSoat,
  taoDon,
  thongKe,
} from "./index.ts";
import {
  bangTonKho,
  chuyenKho,
  dieuChinhTon,
  nhanHangChuyen,
  nhapKho,
  tonTheoDiaDiem,
} from "@aescentic/inventory";

const URL = process.env.DATABASE_URL;

if (!URL) {
  console.warn(
    "\n⚠  BỎ QUA test bán hàng: chưa đặt DATABASE_URL.\n" +
      "   Chúng chỉ chạy trên PostgreSQL thật. Xem aescentic-os/README.md.\n",
  );
}

let db: Db;
/** CEO — thấy toàn bộ. */
let jen: Principal;
/** Nhân viên bán lẻ CH-DK — chỉ thấy cửa hàng mình. */
let nvDongKhoi: Principal;
/** Nhân viên bán lẻ CH-TD — dùng để chứng minh hai người không thấy nhau. */
let nvThaoDien: Principal;
let idCuaHangDK: string;
let idKhoDK: string;
let idSku: string;
let giaSku: number;

const REF = "TEST-SALES-";
/** Số hàng nạp tạm để test có cái mà bán. Được thu hồi hết ở `after()`. */
const NAP_TON = 100;

async function nguoiDung(email: string): Promise<Principal> {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  const p = await loadPrincipal(db, u!.id);
  assert.ok(p, `không nạp được principal cho ${email}`);
  return p;
}

/** Xoá sạch dấu vết của lần chạy trước để bộ test chạy lại được nhiều lần. */
async function donDep() {
  // Đợt đối soát COD do test tạo: xoá trước vì dòng của nó trỏ vào đơn.
  await db.execute(sql`
    delete from os.cod_batch_lines where tracking_code like ${REF + "%"}`);
  await db.execute(sql`
    delete from os.cod_batches
    where not exists (select 1 from os.cod_batch_lines l where l.batch_id = os.cod_batches.id)
      and (file_name = 'test.csv' or file_name is null)`);

  const cu = await db.select({ id: orders.id }).from(orders).where(like(orders.externalRef, `${REF}%`));
  for (const o of cu) {
    // Đưa về 'cancelled' để trigger hoàn kho, rồi mới xoá — nếu xoá thẳng thì
    // tồn kho bị lệch và các lần chạy sau sẽ đo sai.
    await db.execute(sql`update os.orders set status = 'cancelled' where id = ${o.id}::uuid`);
    await db.delete(orderLines).where(eq(orderLines.orderId, o.id));
    await db.delete(orders).where(eq(orders.id, o.id));
  }
}

describe("Bán hàng & kho", { skip: URL ? false : "Chưa đặt DATABASE_URL" }, () => {
  before(async () => {
    await chayMigrations(URL);
    db = taoDb(URL);

    // `before` hỏng mà kết nối còn mở thì tiến trình node không thoát được: bộ
    // test treo im lặng thay vì báo lỗi. Đóng kết nối rồi ném lại để thấy ngay.
    try {
      await chuanBi();
    } catch (e) {
      await db.$sql.end({ timeout: 5 }).catch(() => {});
      throw e;
    }
  });

  async function chuanBi() {
    await seed(db);

    jen = await nguoiDung("jen@aescentic.vn");
    nvDongKhoi = await nguoiDung("nv1.dk@aescentic.vn");
    nvThaoDien = await nguoiDung("nv1.td@aescentic.vn");

    const [ch] = await db.select().from(stores).where(eq(stores.code, "CH-DK"));
    idCuaHangDK = ch!.id;
    const [kho] = await db
      .select()
      .from(inventoryLocations)
      .where(eq(inventoryLocations.code, "CH-DK-BAN"));
    idKhoDK = kho!.id;

    const [s] = await db.select().from(skus).orderBy(skus.code).limit(1);
    idSku = s!.id;
    giaSku = s!.retailPrice;

    await donDep();

    // Nạp sẵn tồn để bán: ghi thẳng vào sổ kho qua hàm của database.
    await db.execute(
      sql`select os.fn_apply_stock_move(${idSku}::uuid, ${idKhoDK}::uuid, ${NAP_TON},
                                        'receipt', 'test', null, 'nạp cho test')`,
    );
  }

  after(async () => {
    // Trả kho về đúng như trước khi test chạy. Không có bước này thì mỗi lần
    // chạy test lại bơm thêm hàng vào database dùng chung, và sau vài lần con
    // số tồn kho trên màn hình demo thành vô lý.
    await donDep();
    await db.execute(
      sql`select os.fn_apply_stock_move(${idSku}::uuid, ${idKhoDK}::uuid, ${-NAP_TON},
                                        'stock_count', 'test', null, 'thu hồi hàng nạp cho test')`,
    );
    await db.$sql.end({ timeout: 5 });
  });

  test("bán hàng trừ đúng số lượng trong kho", async () => {
    const truoc = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;

    await taoDon(
      { db, principal: jen },
      {
        channel: "store",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}1`,
        paymentStatus: "paid",
        chotSang: "completed",
        lines: [{ skuId: idSku, quantity: 3, unitPrice: giaSku }],
      },
    );

    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, truoc - 3, "bán 3 cái thì tồn phải giảm đúng 3");
  });

  test("huỷ đơn thì hoàn kho, không cần ai nhớ làm tay", async () => {
    const truoc = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;

    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "shopee",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}2`,
        chotSang: "confirmed",
        lines: [{ skuId: idSku, quantity: 5, unitPrice: giaSku }],
      },
    );
    const giua = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(giua, truoc - 5);

    await doiTrangThai({ db, principal: jen }, id, "cancelled");
    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, truoc, "huỷ rồi thì tồn phải về như cũ");
  });

  test("không cho nhảy trạng thái lung tung", async () => {
    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "website",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}3`,
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );

    // 'new' → 'returned' là vô nghĩa: chưa giao thì hoàn cái gì.
    await assert.rejects(
      () => doiTrangThai({ db, principal: jen }, id, "returned"),
      /Không chuyển được/,
    );
    // Đường đi hợp lệ thì phải chạy.
    await doiTrangThai({ db, principal: jen }, id, "confirmed");
    const ct = await chiTietDon({ db, principal: jen }, id);
    assert.equal(ct!.don.status, "confirmed");
  });

  test("đơn cộng đúng tiền: hàng + ship − giảm giá", async () => {
    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "tiktok",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}4`,
        shippingFee: 30_000,
        discount: 50_000,
        lines: [{ skuId: idSku, quantity: 2, unitPrice: giaSku }],
      },
    );
    const ct = await chiTietDon({ db, principal: jen }, id);
    assert.equal(ct!.don.subtotal, giaSku * 2);
    assert.equal(ct!.don.total, giaSku * 2 + 30_000 - 50_000);
  });

  test("nhân viên cửa hàng này không thấy đơn của cửa hàng kia", async () => {
    const cuaJen = await danhSachDon({ db, principal: jen }, { tuKhoa: `${REF}` });
    assert.ok(cuaJen.length > 0, "CEO phải thấy đơn");

    const cuaTD = await danhSachDon({ db, principal: nvThaoDien }, { tuKhoa: `${REF}` });
    assert.equal(cuaTD.length, 0, "nhân viên Thảo Điền không được thấy đơn Đồng Khởi");
  });

  test("nhân viên không tạo được đơn cho cửa hàng khác", async () => {
    const [khac] = await db.select().from(stores).where(eq(stores.code, "CH-TD"));
    await assert.rejects(
      () =>
        taoDon(
          { db, principal: nvDongKhoi },
          {
            channel: "store",
            storeId: khac!.id,
            locationId: idKhoDK,
            externalRef: `${REF}9`,
            lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
          },
        ),
      /không được tạo đơn/i,
    );
  });

  test("đơn phải có hàng", async () => {
    await assert.rejects(
      () =>
        taoDon(
          { db, principal: jen },
          {
            channel: "store",
            storeId: idCuaHangDK,
            locationId: idKhoDK,
            externalRef: `${REF}10`,
            lines: [],
          },
        ),
      /ít nhất một sản phẩm/,
    );
  });

  test("chỉ đơn hoàn thành mới tính doanh thu", async () => {
    const tu = new Date(Date.now() - 86_400_000);
    const den = new Date(Date.now() + 86_400_000);
    const truoc = await thongKe({ db, principal: jen }, tu, den);

    // Đơn 'confirmed': chưa xong, không được cộng vào doanh thu.
    await taoDon(
      { db, principal: jen },
      {
        channel: "facebook",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}5`,
        chotSang: "confirmed",
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );
    const giua = await thongKe({ db, principal: jen }, tu, den);
    assert.equal(giua.doanhThu, truoc.doanhThu, "đơn chưa xong mà đã tính tiền");

    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "facebook",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}6`,
        chotSang: "confirmed",
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );
    await doiTrangThai({ db, principal: jen }, id, "completed");
    const sau = await thongKe({ db, principal: jen }, tu, den);
    assert.equal(sau.doanhThu, truoc.doanhThu + giaSku);
  });

  test("doanh thu chia theo kênh cộng lại bằng tổng", async () => {
    const tu = new Date(Date.now() - 86_400_000);
    const den = new Date(Date.now() + 86_400_000);
    const [tong, theoKenh] = await Promise.all([
      thongKe({ db, principal: jen }, tu, den),
      doanhThuTheoKenh({ db, principal: jen }, tu, den),
    ]);
    const cong = theoKenh.reduce((a, k) => a + Number(k.doanhThu), 0);
    assert.equal(cong, tong.doanhThu);
  });

  test("giá vốn: người không có quyền không đọc được", async () => {
    const bangCuaJen = await bangTonKho({ db, principal: jen });
    assert.ok(bangCuaJen.length > 0);
    assert.ok(
      bangCuaJen.some((r) => r.unitCost !== null),
      "CEO phải xem được giá vốn",
    );

    const bangCuaNV = await bangTonKho({ db, principal: nvDongKhoi });
    assert.ok(bangCuaNV.length > 0, "nhân viên vẫn phải xem được tồn kho");
    for (const r of bangCuaNV) {
      assert.equal(r.unitCost, null, "nhân viên bán lẻ không được thấy giá vốn");
    }
  });

  test("kiểm kho ghi chênh lệch và bắt buộc có lý do", async () => {
    const truoc = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;

    await assert.rejects(
      () =>
        dieuChinhTon(
          { db, principal: jen },
          { skuId: idSku, locationId: idKhoDK, thucTe: truoc - 2, lyDo: "   " },
        ),
      /lý do/,
    );

    const delta = await dieuChinhTon(
      { db, principal: jen },
      { skuId: idSku, locationId: idKhoDK, thucTe: truoc - 2, lyDo: "Kiểm kho cuối ngày" },
    );
    assert.equal(delta, -2);

    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, truoc - 2);

    const [ghi] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.event, "inventory.adjusted"), eq(auditLog.entityId, idSku)))
      .orderBy(desc(auditLog.id))
      .limit(1);
    assert.ok(ghi, "phải có nhật ký kiểm kho");
    assert.equal(ghi!.reason, "Kiểm kho cuối ngày");

    // Trả lại như cũ để test khác không bị ảnh hưởng.
    await dieuChinhTon(
      { db, principal: jen },
      { skuId: idSku, locationId: idKhoDK, thucTe: truoc, lyDo: "hoàn lại sau test" },
    );
  });

  test("nhân viên bán lẻ không được tự điều chỉnh tồn", async () => {
    await assert.rejects(
      () =>
        dieuChinhTon(
          { db, principal: nvDongKhoi },
          { skuId: idSku, locationId: idKhoDK, thucTe: 0, lyDo: "thử" },
        ),
      /Không có quyền/,
    );
  });

  test("không bán quá tồn kho", async () => {
    const con = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    await assert.rejects(
      () =>
        taoDon(
          { db, principal: jen },
          {
            channel: "store",
            storeId: idCuaHangDK,
            locationId: idKhoDK,
            externalRef: `${REF}7`,
            chotSang: "completed",
            lines: [{ skuId: idSku, quantity: con + 50, unitPrice: giaSku }],
          },
        ),
      /tồn|âm|không đủ/i,
    );

    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, con, "đơn hỏng không được để lại dấu vết trong kho");
  });

  test("tạo đơn có ghi nhật ký và phát sự kiện", async () => {
    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "store",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}8`,
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );

    const [ghi] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.event, "order.created"), eq(auditLog.entityId, id)));
    assert.ok(ghi, "tạo đơn phải có nhật ký");

    const [sk] = await db
      .select()
      .from(domainEvents)
      .where(and(eq(domainEvents.name, "ORDER_CREATED"), eq(domainEvents.entityId, id)));
    assert.ok(sk, "tạo đơn phải phát sự kiện cho các module khác");
  });

  test("tồn kho không bao giờ âm, kể cả khi gọi thẳng vào database", async () => {
    // Đường bán hàng có thông báo thiếu hàng riêng, nhưng mọi đường khác —
    // kiểm kho, chuyển kho, một câu SQL gọi tay — cũng phải bị chặn.
    const truoc = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;

    await assert.rejects(
      () =>
        db.execute(
          sql`select os.fn_apply_stock_move(${idSku}::uuid, ${idKhoDK}::uuid, ${-(truoc + 1)},
                                            'sale', null, null, null)`,
        ),
      /không được âm/i,
    );

    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, truoc, "thao tác bị chặn không được để lại dấu vết");
  });

  test("kiểm kho về số âm cũng bị chặn", async () => {
    await assert.rejects(
      () =>
        dieuChinhTon(
          { db, principal: jen },
          { skuId: idSku, locationId: idKhoDK, thucTe: -5, lyDo: "gõ nhầm dấu trừ" },
        ),
      /không được âm/i,
    );
  });

  test("bộ test trả kho về đúng số đã nạp, không để lại rác", async () => {
    // Chạy cuối cùng: mọi test trên đã dọn phần của mình, nên chênh lệch còn
    // lại phải đúng bằng số hàng nạp ở `before()`.
    const con = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.ok(
      con >= NAP_TON,
      `còn ${con}, phải còn ít nhất ${NAP_TON} để after() thu hồi mà không âm`,
    );
  });

  test("đơn đã trừ kho: sửa được tên hiển thị nhưng không sửa được số lượng hay giá", async () => {
    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "store",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}11`,
        chotSang: "completed",
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );
    const ct = await chiTietDon({ db, principal: jen }, id);
    const dongId = ct!.dong[0]!.id;

    // Tên in trên phiếu giao hàng: sửa được, không đụng gì tới kho hay tiền.
    await db
      .update(orderLines)
      .set({ displayName: "Tên in lại cho khách dễ đọc" })
      .where(eq(orderLines.id, dongId));
    const sau = await chiTietDon({ db, principal: jen }, id);
    assert.equal(sau!.dong[0]!.displayName, "Tên in lại cho khách dễ đọc");

    // Số lượng: cấm, vì kho đã trừ theo con số cũ.
    await assert.rejects(
      () => db.update(orderLines).set({ quantity: 9 }).where(eq(orderLines.id, dongId)),
      /số lượng/,
    );

    // Giá: cấm, vì tiền đã thu theo giá cũ.
    await assert.rejects(
      () => db.update(orderLines).set({ unitPrice: 1 }).where(eq(orderLines.id, dongId)),
      /không đổi được giá/,
    );

    // Thêm dòng mới vào đơn đã chốt: cấm.
    await assert.rejects(
      () =>
        db.insert(orderLines).values({
          orderId: id,
          skuId: idSku,
          quantity: 1,
          unitPrice: giaSku,
        }),
      /thêm\/bớt hàng/,
    );
  });

  test("đối soát COD: chốt xong đơn chuyển sang đã thanh toán", async () => {
    const maVanDon = `${REF}VD1`;
    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "shopee",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}COD1`,
        paymentStatus: "cod",
        carrier: "GHTK",
        trackingCode: maVanDon,
        chotSang: "shipping",
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );

    const cho = await donCodChuaDoiSoat({ db, principal: jen }, "GHTK");
    const cuaTa = cho.find((o) => o.id === id);
    assert.ok(cuaTa, "đơn COD đang giao phải nằm trong danh sách chờ đối soát");

    const kq = await chotDoiSoatCod(
      { db, principal: jen },
      {
        carrier: "GHTK",
        fileName: "test.csv",
        chot: [
          {
            orderId: id,
            trackingCode: maVanDon,
            soTien: Number(cuaTa.total),
            soTienDuKien: Number(cuaTa.total),
            trangThai: "khop",
          },
        ],
        tatCa: [
          {
            orderId: id,
            trackingCode: maVanDon,
            soTien: Number(cuaTa.total),
            soTienDuKien: Number(cuaTa.total),
            trangThai: "khop",
          },
        ],
      },
    );
    assert.equal(kq.daChot, 1);

    const ct = await chiTietDon({ db, principal: jen }, id);
    assert.equal(ct!.don.paymentStatus, "paid", "đối soát xong phải là đã thanh toán");
    assert.ok(ct!.don.codReconciledAt, "phải ghi thời điểm đối soát");
    assert.equal(Number(ct!.don.codAmount), Number(cuaTa.total));

    // Không còn nằm trong danh sách chờ nữa
    const sau = await donCodChuaDoiSoat({ db, principal: jen }, "GHTK");
    assert.ok(!sau.some((o) => o.id === id), "đơn đã đối soát không được hiện lại");

    const [ghi] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.event, "cod.reconciled"))
      .orderBy(desc(auditLog.id))
      .limit(1);
    assert.ok(ghi, "đối soát phải ghi nhật ký");
  });

  test("đối soát lại lần hai không ghi đè thời điểm đã chốt", async () => {
    const maVanDon = `${REF}VD2`;
    const id = await taoDon(
      { db, principal: jen },
      {
        channel: "shopee",
        storeId: idCuaHangDK,
        locationId: idKhoDK,
        externalRef: `${REF}COD2`,
        paymentStatus: "cod",
        carrier: "GHN",
        trackingCode: maVanDon,
        chotSang: "shipping",
        lines: [{ skuId: idSku, quantity: 1, unitPrice: giaSku }],
      },
    );

    const dong = {
      orderId: id,
      trackingCode: maVanDon,
      soTien: giaSku,
      soTienDuKien: giaSku,
      trangThai: "khop",
    };
    await chotDoiSoatCod({ db, principal: jen }, { carrier: "GHN", chot: [dong], tatCa: [dong] });
    const lan1 = (await chiTietDon({ db, principal: jen }, id))!.don.codReconciledAt;

    // Gửi lại đúng dòng đó: câu update có điều kiện `chưa đối soát` nên không đụng
    await chotDoiSoatCod(
      { db, principal: jen },
      { carrier: "GHN", chot: [{ ...dong, soTien: 1 }], tatCa: [{ ...dong, soTien: 1 }] },
    );
    const ct = (await chiTietDon({ db, principal: jen }, id))!.don;
    assert.deepEqual(ct.codReconciledAt, lan1, "không được ghi đè lần đối soát đầu");
    assert.equal(Number(ct.codAmount), giaSku, "số tiền phải giữ nguyên của lần chốt đầu");
  });

  test("nhân viên bán lẻ không được chốt đối soát COD", async () => {
    await assert.rejects(
      () =>
        chotDoiSoatCod(
          { db, principal: nvDongKhoi },
          { carrier: "GHTK", chot: [], tatCa: [] },
        ),
      /Không có quyền/,
    );
  });

  test("nhập kho cộng tồn và cập nhật giá vốn", async () => {
    const truoc = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    const vonMoi = 777_000;

    const phieu = await nhapKho(
      { db, principal: jen },
      {
        locationId: idKhoDK,
        supplierName: "Xưởng test",
        note: "nhập cho test",
        lines: [{ skuId: idSku, quantity: 7, unitCost: vonMoi }],
      },
    );
    assert.ok(phieu.code, "phiếu nhập phải có mã");

    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, truoc + 7);

    const bang = await bangTonKho({ db, principal: jen });
    const dongSku = bang.find((r) => r.skuId === idSku)!;
    assert.equal(dongSku.unitCost, vonMoi, "giá vốn phải cập nhật theo giá nhập mới nhất");

    // Trả kho về như cũ
    await dieuChinhTon(
      { db, principal: jen },
      { skuId: idSku, locationId: idKhoDK, thucTe: truoc, lyDo: "hoàn lại sau test nhập kho" },
    );
  });

  test("nhập kho phải có số lượng dương và giá vốn không âm", async () => {
    await assert.rejects(
      () =>
        nhapKho(
          { db, principal: jen },
          { locationId: idKhoDK, lines: [{ skuId: idSku, quantity: 0, unitCost: 1000 }] },
        ),
      /lớn hơn 0/,
    );
    await assert.rejects(
      () =>
        nhapKho(
          { db, principal: jen },
          { locationId: idKhoDK, lines: [{ skuId: idSku, quantity: 1, unitCost: -5 }] },
        ),
      /không được âm/,
    );
    await assert.rejects(
      () => nhapKho({ db, principal: jen }, { locationId: idKhoDK, lines: [] }),
      /ít nhất một sản phẩm/,
    );
  });

  test("chuyển kho: hàng rời kho gửi ngay, vào kho nhận khi xác nhận", async () => {
    const [khoTester] = await db
      .select()
      .from(inventoryLocations)
      .where(eq(inventoryLocations.code, "CH-DK-TESTER"));
    assert.ok(khoTester, "cần kho tester của Đồng Khởi để test");

    const guiTruoc = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    const nhanTruoc =
      (await tonTheoDiaDiem({ db, principal: jen }, khoTester.id)).get(idSku) ?? 0;

    const phieu = await chuyenKho(
      { db, principal: jen },
      {
        fromLocationId: idKhoDK,
        toLocationId: khoTester.id,
        note: "chuyển cho test",
        lines: [{ skuId: idSku, quantity: 4 }],
      },
    );

    // Đã trừ kho gửi, CHƯA cộng kho nhận — hàng đang trên đường
    const guiGiua = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    const nhanGiua = (await tonTheoDiaDiem({ db, principal: jen }, khoTester.id)).get(idSku) ?? 0;
    assert.equal(guiGiua, guiTruoc - 4, "kho gửi phải trừ ngay");
    assert.equal(nhanGiua, nhanTruoc, "kho nhận chưa được cộng khi hàng còn trên đường");

    await nhanHangChuyen({ db, principal: jen }, phieu.id);

    const nhanSau = (await tonTheoDiaDiem({ db, principal: jen }, khoTester.id)).get(idSku) ?? 0;
    assert.equal(nhanSau, nhanTruoc + 4, "xác nhận xong hàng mới vào kho nhận");

    // Nhận lần hai phải bị chặn
    await assert.rejects(() => nhanHangChuyen({ db, principal: jen }, phieu.id), /không nhận được/);

    // Chuyển ngược lại cho sạch
    const ve = await chuyenKho(
      { db, principal: jen },
      {
        fromLocationId: khoTester.id,
        toLocationId: idKhoDK,
        lines: [{ skuId: idSku, quantity: 4 }],
      },
    );
    await nhanHangChuyen({ db, principal: jen }, ve.id);
    const guiCuoi = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(guiCuoi, guiTruoc);
  });

  test("không chuyển được nhiều hơn tồn kho gửi", async () => {
    const [khoTester] = await db
      .select()
      .from(inventoryLocations)
      .where(eq(inventoryLocations.code, "CH-DK-TESTER"));
    const con = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;

    await assert.rejects(
      () =>
        chuyenKho(
          { db, principal: jen },
          {
            fromLocationId: idKhoDK,
            toLocationId: khoTester!.id,
            lines: [{ skuId: idSku, quantity: con + 100 }],
          },
        ),
      /không đủ hàng/i,
    );

    const sau = (await tonTheoDiaDiem({ db, principal: jen }, idKhoDK)).get(idSku) ?? 0;
    assert.equal(sau, con, "phiếu hỏng không được để lại dấu vết trong kho");
  });

  test("không chuyển kho về chính nó", async () => {
    await assert.rejects(
      () =>
        chuyenKho(
          { db, principal: jen },
          { fromLocationId: idKhoDK, toLocationId: idKhoDK, lines: [{ skuId: idSku, quantity: 1 }] },
        ),
      /phải khác nhau/,
    );
  });

  test("nhân viên bán lẻ không được nhập kho hay chuyển kho", async () => {
    await assert.rejects(
      () =>
        nhapKho(
          { db, principal: nvDongKhoi },
          { locationId: idKhoDK, lines: [{ skuId: idSku, quantity: 1, unitCost: 1000 }] },
        ),
      /Không có quyền/,
    );
    await assert.rejects(
      () =>
        chuyenKho(
          { db, principal: nvDongKhoi },
          { fromLocationId: idKhoDK, toLocationId: idKhoDK, lines: [] },
        ),
      /Không có quyền/,
    );
  });

  test("số dư kho khớp với tổng sổ kho", async () => {
    const [kq] = await db.execute<{ lech: number }>(sql`
      select count(*)::int as lech from (
        select b.sku_id, b.location_id, b.quantity,
               coalesce(sum(t.delta), 0) as tong
        from os.inventory_balances b
        left join os.inventory_transactions t
          on t.sku_id = b.sku_id and t.location_id = b.location_id
        group by b.sku_id, b.location_id, b.quantity
        having b.quantity <> coalesce(sum(t.delta), 0)
      ) x`);
    assert.equal(Number(kq?.lech ?? -1), 0, "số dư kho lệch so với sổ kho");
  });
});
