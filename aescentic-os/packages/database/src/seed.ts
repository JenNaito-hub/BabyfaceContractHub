/**
 * Dữ liệu mẫu Phase 0.
 *
 * Tất định (không random) để test so sánh được. Chạy lại nhiều lần không tạo trùng.
 * KHÔNG chạy trên môi trường thật — xem cảnh báo ở cuối.
 */
import { sql } from "drizzle-orm";
import { taoDb, type Db } from "./client.ts";
import {
  categories,
  collections,
  configSettings,
  departments,
  employees,
  fragranceProfiles,
  integrationAccounts,
  inventoryLocations,
  productCosts,
  products,
  regions,
  roles,
  skus,
  stores,
  userRoles,
  userStoreAssignments,
  users,
} from "./schema/index.ts";

const VUNG = [
  { code: "HCM", name: "TP. Hồ Chí Minh" },
  { code: "HN", name: "Hà Nội" },
  { code: "MT", name: "Miền Trung" },
];

const PHONG_BAN = [
  { code: "OPS", name: "Vận hành" },
  { code: "SALES", name: "Kinh doanh" },
  { code: "HR", name: "Nhân sự" },
  { code: "FIN", name: "Tài chính — Kế toán" },
  { code: "MKT", name: "Marketing" },
  { code: "SUPPLY", name: "Cung ứng — Sản xuất" },
];

const CUA_HANG = [
  { code: "KHO-TT", name: "Kho trung tâm", kind: "warehouse", region: "HCM", district: "TP. Thủ Đức" },
  { code: "CH-DK", name: "Aescentic Đồng Khởi", kind: "store", region: "HCM", district: "Quận 1" },
  { code: "CH-TD", name: "Aescentic Thảo Điền", kind: "store", region: "HCM", district: "TP. Thủ Đức" },
  { code: "CH-PMH", name: "Aescentic Phú Mỹ Hưng", kind: "store", region: "HCM", district: "Quận 7" },
  { code: "CH-TT", name: "Aescentic Tràng Tiền", kind: "store", region: "HN", district: "Quận Hoàn Kiếm" },
  { code: "CH-BD", name: "Aescentic Bạch Đằng", kind: "store", region: "MT", district: "Quận Hải Châu" },
  { code: "ONLINE", name: "Kênh online", kind: "online", region: "HCM", district: "Quận 1" },
];

const BO_SUU_TAP = [
  { code: "SIG", name: "Signature", story: "Dòng chủ lực, hương ấm và sâu" },
  { code: "FRESH", name: "Fresh", story: "Hương tươi mát cho ban ngày" },
  { code: "NUIT", name: "Nuit", story: "Hương đêm, nồng và gợi cảm" },
  { code: "TRAVEL", name: "Travel", story: "Dung tích nhỏ mang theo" },
];

const HUONG = ["Amber", "Blanc", "Cèdre", "Néroli", "Pluie", "Rose", "Vanille", "Thé", "Oud", "Iris"];

const NHAN_SU = [
  ["ceo", "Jen Naito", "jen@aescentic.vn", null],
  ["ops_manager", "Lê Vận Hành", "ops@aescentic.vn", null],
  ["regional_manager", "Trần Vùng HCM", "vung.hcm@aescentic.vn", null],
  ["hr", "Phạm Nhân Sự", "hr@aescentic.vn", null],
  ["accounting", "Vũ Kế Toán", "ketoan@aescentic.vn", null],
  ["finance", "Đỗ Tài Chính", "taichinh@aescentic.vn", null],
  ["marketing", "Bùi Marketing", "marketing@aescentic.vn", null],
  ["crm", "Hoàng Chăm Sóc", "crm@aescentic.vn", null],
  ["procurement", "Đặng Mua Hàng", "muahang@aescentic.vn", null],
  ["production", "Ngô Sản Xuất", "sanxuat@aescentic.vn", null],
  ["qc", "Lý Kiểm Định", "qc@aescentic.vn", null],
  ["warehouse", "Trịnh Thủ Kho", "kho@aescentic.vn", "KHO-TT"],
  ["b2b_sales", "Cao B2B", "b2b@aescentic.vn", null],
  ["account_manager", "Dương Account", "account@aescentic.vn", null],
  ["store_manager", "Mai QL Đồng Khởi", "ql.dk@aescentic.vn", "CH-DK"],
  ["store_manager", "Nguyễn QL Thảo Điền", "ql.td@aescentic.vn", "CH-TD"],
  ["retail_sales", "Ngọc NV Đồng Khởi", "nv1.dk@aescentic.vn", "CH-DK"],
  ["retail_sales", "Linh NV Đồng Khởi", "nv2.dk@aescentic.vn", "CH-DK"],
  ["retail_sales", "Hà NV Thảo Điền", "nv1.td@aescentic.vn", "CH-TD"],
  ["retail_sales", "Trâm NV Tràng Tiền", "nv1.tt@aescentic.vn", "CH-TT"],
] as const;

export async function seed(db: Db): Promise<void> {
  await db
    .insert(regions)
    .values(VUNG)
    .onConflictDoNothing({ target: regions.code });
  await db
    .insert(departments)
    .values(PHONG_BAN)
    .onConflictDoNothing({ target: departments.code });

  const dsVung = await db.select().from(regions);
  const idVung = new Map(dsVung.map((r) => [r.code, r.id]));

  await db
    .insert(stores)
    .values(
      CUA_HANG.map((c, i) => ({
        code: c.code,
        name: c.name,
        kind: c.kind,
        regionId: idVung.get(c.region)!,
        province: c.region === "HN" ? "Hà Nội" : c.region === "MT" ? "Đà Nẵng" : "TP. Hồ Chí Minh",
        district: c.district,
        address: `Số ${10 + i} đường mẫu`,
        phone: `02839${String(111000 + i)}`,
      })),
    )
    .onConflictDoNothing({ target: stores.code });

  const dsCuaHang = await db.select().from(stores);
  const idCuaHang = new Map(dsCuaHang.map((s) => [s.code, s.id]));

  // Địa điểm kho: mỗi cửa hàng có kho bán + kho tester; kho bán do Nhanh quản
  const diaDiem: (typeof inventoryLocations.$inferInsert)[] = [];
  for (const c of CUA_HANG) {
    if (c.kind === "online") continue;
    diaDiem.push({
      code: `${c.code}-BAN`,
      name: `${c.name} — hàng bán`,
      storeId: idCuaHang.get(c.code)!,
      kind: "sellable",
      // managedBy đặt bên dưới theo luật `os.kho_ban_do_ai_quan()`.
    });
    diaDiem.push({
      code: `${c.code}-TESTER`,
      name: `${c.name} — tester`,
      storeId: idCuaHang.get(c.code)!,
      kind: "tester",
      managedBy: "os",
    });
  }
  diaDiem.push({
    code: "QUA-TANG",
    name: "Kho quà tặng marketing",
    storeId: idCuaHang.get("KHO-TT")!,
    kind: "gift",
    managedBy: "os",
  });
  await db.insert(inventoryLocations).values(diaDiem).onConflictDoNothing({
    target: inventoryLocations.code,
  });

  // Ai quản kho hàng bán là một LUẬT, không phải hằng số chép tay: chừng nào
  // Nhanh.vn chưa đồng bộ lần nào thì OS tự quản để Jen còn bán được; ngay khi
  // Nhanh.vn chạy thật, trigger ở migration 0004 đổi chủ và chặn OS ghi tiếp.
  await db.execute(sql`
    update os.inventory_locations
    set managed_by = os.kho_ban_do_ai_quan()
    where kind = 'sellable' and managed_by <> os.kho_ban_do_ai_quan()`);

  await db
    .insert(categories)
    .values([
      { code: "EDP", name: "Eau de Parfum" },
      { code: "EDT", name: "Eau de Toilette" },
      { code: "OIL", name: "Tinh dầu khuếch tán" },
    ])
    .onConflictDoNothing({ target: categories.code });

  await db
    .insert(collections)
    .values(BO_SUU_TAP)
    .onConflictDoNothing({ target: collections.code });

  const dsDanhMuc = await db.select().from(categories);
  const dsBst = await db.select().from(collections);
  const idDanhMuc = new Map(dsDanhMuc.map((c) => [c.code, c.id]));
  const idBst = new Map(dsBst.map((c) => [c.code, c.id]));

  // 30 sản phẩm = 10 hương × 3 biến tấu
  const sanPham: (typeof products.$inferInsert)[] = [];
  for (let i = 0; i < HUONG.length; i++) {
    for (const [j, hau] of ["Nuit", "Matin", "Absolu"].entries()) {
      const code = `AES-${String(i * 3 + j + 1).padStart(3, "0")}`;
      sanPham.push({
        code,
        name: `${HUONG[i]} ${hau}`,
        categoryId: idDanhMuc.get(j === 2 ? "EDP" : "EDT")!,
        collectionId: idBst.get(BO_SUU_TAP[(i + j) % BO_SUU_TAP.length]!.code)!,
        lifecycle: j === 2 && i > 7 ? "launch" : "active",
        description: `Hương ${HUONG[i]!.toLowerCase()} phiên bản ${hau}`,
      });
    }
  }
  await db.insert(products).values(sanPham).onConflictDoNothing({ target: products.code });

  const dsSanPham = await db.select().from(products);

  const dsSku: (typeof skus.$inferInsert)[] = [];
  for (const p of dsSanPham) {
    for (const ml of [50, 100]) {
      dsSku.push({
        productId: p.id,
        code: `${p.code}-${ml}`,
        name: `${p.name} ${ml}ml`,
        volumeMl: ml,
        barcode: `893${p.code.replace(/\D/g, "").padStart(6, "0")}${ml}`,
        weightGram: ml === 50 ? 320 : 540,
        retailPrice: ml === 50 ? 1_290_000 : 1_950_000,
        wholesalePrice: ml === 50 ? 890_000 : 1_390_000,
        reorderPoint: ml === 50 ? 6 : 4,
      });
    }
  }
  await db.insert(dsSku.length ? skus : skus).values(dsSku).onConflictDoNothing({
    target: skus.code,
  });

  const dsSkuDb = await db.select({ id: skus.id, volumeMl: skus.volumeMl }).from(skus);
  await db
    .insert(productCosts)
    .values(
      dsSkuDb.map((s) => ({
        skuId: s.id,
        unitCost: s.volumeMl === 50 ? 516_000 : 760_000,
      })),
    )
    .onConflictDoNothing({ target: productCosts.skuId });

  await db
    .insert(fragranceProfiles)
    .values(
      dsSanPham.map((p, i) => ({
        productId: p.id,
        family: ["Amber", "Floral", "Woody", "Fresh"][i % 4]!,
        topNotes: ["Bergamot", "Tiêu hồng"],
        middleNotes: ["Hoa nhài", "Hoắc hương"],
        baseNotes: ["Gỗ đàn hương", "Xạ hương"],
        intensity: (["light", "moderate", "strong", "intense"] as const)[i % 4]!,
        longevityHours: 6 + (i % 5),
        seasons: i % 2 === 0 ? ["Thu", "Đông"] : ["Xuân", "Hạ"],
        occasions: ["Đi làm", "Dạ tiệc"],
        timeOfDay: (["day", "night", "both"] as const)[i % 3]!,
        story: p.description,
        sellingPoints: ["Lưu hương lâu", "Toả hương vừa phải", "Hợp khí hậu ẩm"],
      })),
    )
    .onConflictDoNothing({ target: fragranceProfiles.productId });

  // Người dùng + vai trò
  await db
    .insert(users)
    .values(NHAN_SU.map(([, ten, email]) => ({ email, fullName: ten })))
    .onConflictDoNothing({ target: users.email });

  const dsUser = await db.select().from(users);
  const idUser = new Map(dsUser.map((u) => [u.email, u.id]));
  const dsVaiTro = await db.select().from(roles);
  const idVaiTro = new Map(dsVaiTro.map((r) => [r.code, r.id]));

  await db
    .insert(userRoles)
    .values(
      NHAN_SU.filter(([code]) => idVaiTro.has(code)).map(([code, , email]) => ({
        userId: idUser.get(email)!,
        roleId: idVaiTro.get(code)!,
      })),
    )
    .onConflictDoNothing();

  const ganCuaHang = NHAN_SU.filter(([, , , ch]) => ch !== null).map(([, , email, ch]) => ({
    userId: idUser.get(email)!,
    storeId: idCuaHang.get(ch!)!,
  }));
  if (ganCuaHang.length) {
    await db.insert(userStoreAssignments).values(ganCuaHang).onConflictDoNothing();
  }

  const dsNhanVien = NHAN_SU.map(([, ten, email, ch], i) => ({
    userId: idUser.get(email)!,
    code: `NV${String(i + 1).padStart(3, "0")}`,
    fullName: ten,
    email,
    primaryStoreId: ch ? idCuaHang.get(ch)! : null,
    jobTitle: ten.split(" ").slice(1).join(" "),
    hiredAt: "2024-01-15",
  }));
  await db.insert(employees).values(dsNhanVien).onConflictDoNothing({ target: employees.code });

  // Cấu hình mặc định — có thể sửa trong admin, không hard-code trong code
  await db
    .insert(configSettings)
    .values([
      { key: "inventory.low_stock_days", value: 14 as never },
      { key: "payroll.overtime_multiplier", value: 1.5 as never },
      { key: "payroll.late_grace_minutes", value: 5 as never },
      { key: "b2b.commission_trigger", value: "collected" as never },
      { key: "loyalty.points_per_1000_vnd", value: 1 as never },
      { key: "ai.monthly_token_budget", value: 5_000_000 as never },
    ])
    .onConflictDoNothing();

  await db
    .insert(integrationAccounts)
    .values([
      { provider: "nhanh", label: "chính", config: { note: "Chờ credential" } as never },
      { provider: "zalo_oa", label: "chính", config: {} as never },
      { provider: "anthropic", label: "chính", config: {} as never },
    ])
    .onConflictDoNothing();
}

export async function demSeed(db: Db) {
  const dem = async (t: string) =>
    Number(
      (
        await db.execute<{ n: string }>(sql.raw(`select count(*)::text as n from os.${t}`))
      )[0]?.n ?? 0,
    );
  return {
    stores: await dem("stores"),
    users: await dem("users"),
    roles: await dem("roles"),
    permissions: await dem("permissions"),
    products: await dem("products"),
    skus: await dem("skus"),
    locations: await dem("inventory_locations"),
  };
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const db = taoDb();
  seed(db)
    .then(() => demSeed(db))
    .then(async (d) => {
      console.log("Seed xong:", d);
      await db.$sql.end();
    })
    .catch(async (e) => {
      console.error("Seed lỗi:", e);
      await db.$sql.end();
      process.exit(1);
    });
}
