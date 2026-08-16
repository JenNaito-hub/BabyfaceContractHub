/**
 * Dữ liệu bán hàng mẫu cho `os`: tồn kho đầu kỳ và đơn hàng 45 ngày qua.
 *
 * Chạy SAU `seed.ts`. Tất định (không random ngẫu nhiên) để test so sánh được.
 * Chạy lại không nhân đôi: nhận biết bằng `external_ref` có tiền tố `SEED-`.
 */
import { eq, like, sql } from "drizzle-orm";
import { taoDb, type Db } from "./client.ts";
import {
  inventoryLocations,
  orderLines,
  orders,
  receiptLines,
  skus,
  stockReceipts,
  stores,
} from "./schema/index.ts";

const KENH: { ma: string; tyLe: number }[] = [
  { ma: "shopee", tyLe: 0.26 },
  { ma: "tiktok", tyLe: 0.5 },
  { ma: "facebook", tyLe: 0.68 },
  { ma: "website", tyLe: 0.78 },
  { ma: "store", tyLe: 1 },
];

const TEN_KHACH = [
  "Nguyễn Thị Mai", "Trần Minh Anh", "Lê Hoàng Yến", "Phạm Thu Hà", "Vũ Đức Nam",
  "Đỗ Ngọc Linh", "Bùi Thanh Tùng", "Hoàng Kim Chi", "Đặng Quỳnh Như", "Ngô Bảo Trâm",
  "Lý Gia Hân", "Trịnh Văn Khoa", "Cao Thuỳ Dương", "Dương Hải Yến", "Mai Tuấn Kiệt",
  "Nguyễn Hữu Phước", "Trần Thị Diễm", "Lê Quang Huy", "Phan Bích Ngọc", "Võ Thành Đạt",
  "Huỳnh Mỹ Duyên", "Đinh Công Sơn", "Tạ Khánh Vy", "Chu Minh Quân", "Lâm Tuyết Nhi",
  "Nguyễn Hoài Nam", "Trần Lan Phương", "Phạm Anh Thư", "Bùi Đức Trọng", "Đỗ Hà Vy",
];

const TINH_QUAN: [string, string][] = [
  ["TP. Hồ Chí Minh", "Quận 1"], ["TP. Hồ Chí Minh", "Quận 7"],
  ["Hà Nội", "Quận Cầu Giấy"], ["Hà Nội", "Quận Đống Đa"],
  ["Đà Nẵng", "Quận Hải Châu"], ["Cần Thơ", "Quận Ninh Kiều"],
];

/** Bộ sinh số giả ngẫu nhiên có hạt giống — cùng đầu vào cho cùng kết quả. */
function taoRng(hat: number) {
  let s = hat;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export async function seedBanHang(db: Db): Promise<void> {
  const [daCo] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(like(orders.externalRef, "SEED-%"));
  if ((daCo?.n ?? 0) > 0) return; // đã seed rồi

  const dsSku = await db
    .select({ id: skus.id, code: skus.code, name: skus.name, retailPrice: skus.retailPrice })
    .from(skus)
    .orderBy(skus.code);
  const dsDiaDiem = await db
    .select({
      id: inventoryLocations.id,
      code: inventoryLocations.code,
      kind: inventoryLocations.kind,
      storeId: inventoryLocations.storeId,
    })
    .from(inventoryLocations);
  const dsStore = await db.select({ id: stores.id, code: stores.code }).from(stores);

  const banHang = dsDiaDiem.filter((l) => l.kind === "sellable");
  if (!dsSku.length || !banHang.length) {
    throw new Error("Chưa có SKU hoặc địa điểm kho — chạy seed.ts trước");
  }

  // ---------- Nhập kho đầu kỳ ----------
  const ngayNhap = new Date(Date.now() - 50 * 86_400_000).toISOString().slice(0, 10);
  for (const dd of banHang) {
    const [phieu] = await db
      .insert(stockReceipts)
      .values({
        locationId: dd.id,
        supplierName: "Xưởng Aescentic — Bình Dương",
        receivedOn: ngayNhap,
        note: "Nhập đầu kỳ",
      })
      .returning({ id: stockReceipts.id });
    if (!phieu) continue;

    await db.insert(receiptLines).values(
      dsSku.map((s) => ({
        receiptId: phieu.id,
        skuId: s.id,
        quantity: s.retailPrice > 1_500_000 ? 40 : 70,
        unitCost: Math.round(s.retailPrice * 0.4),
      })),
    );
    // Trigger cộng kho và cập nhật giá vốn
    await db.update(stockReceipts).set({ status: "completed" }).where(eq(stockReceipts.id, phieu.id));
  }

  // ---------- Đơn hàng 45 ngày ----------
  const rng = taoRng(42);
  const online = banHang.find((l) => l.code.startsWith("ONLINE")) ?? banHang[0]!;
  const cuaHang = banHang.filter((l) => l.code.startsWith("CH-"));
  const storeById = new Map(dsStore.map((s) => [s.id, s]));

  for (let i = 0; i < 160; i++) {
    const ngay = new Date(
      Date.now() - Math.floor(rng() * 45) * 86_400_000 - Math.floor(rng() * 10) * 3_600_000,
    );

    const r = rng();
    const kenh = KENH.find((k) => r < k.tyLe)!.ma;
    const taiQuay = kenh === "store";
    const diaDiem = taiQuay ? cuaHang[i % cuaHang.length]! : online;
    if (!diaDiem.storeId) continue;

    const cachNgay = (Date.now() - ngay.getTime()) / 86_400_000;
    const r2 = rng();
    const trangThai = taiQuay
      ? "completed"
      : cachNgay > 10
        ? r2 < 0.88 ? "completed" : r2 < 0.94 ? "cancelled" : "returned"
        : cachNgay > 4
          ? r2 < 0.6 ? "completed" : "shipping"
          : cachNgay > 1
            ? r2 < 0.5 ? "shipping" : "confirmed"
            : "new";

    const k = Math.floor(rng() * TEN_KHACH.length);
    const [tinh, quan] = TINH_QUAN[k % TINH_QUAN.length]!;

    const [don] = await db
      .insert(orders)
      .values({
        channel: kenh,
        storeId: diaDiem.storeId,
        locationId: diaDiem.id,
        customerName: TEN_KHACH[k]!,
        customerPhone: `090${String(1000000 + k).slice(0, 7)}`,
        address: `${10 + (i % 300)} đường Số ${1 + (i % 40)}`,
        province: tinh,
        district: quan,
        paymentStatus: taiQuay ? "paid" : rng() < 0.55 ? "cod" : "paid",
        shippingFee: taiQuay ? 0 : [0, 20000, 30000][i % 3]!,
        discount: rng() < 0.2 ? 50000 : 0,
        carrier: taiQuay ? null : ["GHTK", "GHN", "Viettel Post"][i % 3]!,
        trackingCode: taiQuay ? null : `VD${String(100000 + i)}`,
        externalRef: `SEED-${String(i).padStart(4, "0")}`,
        placedAt: ngay,
      })
      .returning({ id: orders.id });
    if (!don) continue;

    const soDong = 1 + Math.floor(rng() * 3);
    const daChon = new Set<string>();
    for (let j = 0; j < soDong; j++) {
      const s = dsSku[Math.floor(rng() * dsSku.length)]!;
      if (daChon.has(s.id)) continue;
      daChon.add(s.id);
      await db.insert(orderLines).values({
        orderId: don.id,
        skuId: s.id,
        skuCode: s.code,
        // Tên người đọc được, không phải mã. Phiếu giao hàng in ra cho khách
        // và shipper xem — in "AES-007-50" thì không ai biết là hàng gì.
        displayName: s.name ?? s.code,
        quantity: 1 + Math.floor(rng() * 2),
        unitPrice: s.retailPrice,
      });
    }

    if (trangThai !== "new") {
      await db.update(orders).set({ status: trangThai }).where(eq(orders.id, don.id));
    }
  }
}

if (process.argv[1]?.endsWith("seed-sales.ts")) {
  const db = taoDb();
  seedBanHang(db)
    .then(async () => {
      const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(orders);
      console.log(`Seed bán hàng xong: ${n?.n ?? 0} đơn`);
      await db.$sql.end();
    })
    .catch(async (e) => {
      console.error("Lỗi:", e.message);
      await db.$sql.end();
      process.exit(1);
    });
}
