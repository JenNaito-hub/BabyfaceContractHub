import { TRANG_THAI_TINH_DOANH_THU } from "./constants";
import type { Kenh, Order, OrderItem, TrangThaiDon } from "./types";

export function formatVND(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("vi-VN") + " đ";
}

/** Rút gọn cho thẻ số liệu: 1.234.567 → "1,2 tr" */
export function formatVNDShort(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(".", ",") + " tỷ";
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + " tr";
  if (Math.abs(v) >= 1_000) return Math.round(v / 1_000) + "k";
  return String(v);
}

export function formatNgay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatNgayGio(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
}

/** 'YYYY-MM' của tháng hiện tại. */
export function currentThang(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatThang(thang: string): string {
  const [y, m] = thang.split("-");
  return y && m ? `Tháng ${m}/${y}` : thang;
}

/** Khoảng ngày [từ, đến] của 1 tháng 'YYYY-MM', dạng ISO để query Supabase. */
export function khoangThang(thang: string): { tu: string; den: string } {
  const [y, m] = thang.split("-").map(Number);
  const tu = new Date(y, m - 1, 1, 0, 0, 0);
  const den = new Date(y, m, 1, 0, 0, 0);
  return { tu: tu.toISOString(), den: den.toISOString() };
}

/** Ngày 'YYYY-MM-DD' theo giờ địa phương. */
export function ngayLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function laDoanhThu(trangThai: TrangThaiDon): boolean {
  return TRANG_THAI_TINH_DOANH_THU.includes(trangThai);
}

export function tienDongHang(item: Pick<OrderItem, "so_luong" | "don_gia" | "giam_gia">): number {
  return Number(item.so_luong) * Number(item.don_gia) - Number(item.giam_gia ?? 0);
}

export type ThongKe = {
  soDon: number;
  doanhThu: number; // Σ tong_tien của đơn hoàn thành
  tienHang: number; // Σ tam_tinh của đơn hoàn thành (không gồm ship/giảm)
  giaVon: number; // Σ giá vốn — 0 nếu không có quyền xem
  loiNhuan: number;
  soSanPham: number; // tổng số chai bán ra
  giaTriTB: number; // giá trị đơn trung bình
  donHuy: number;
  congNoCod: number; // COD chưa thu của đơn đang giao
};

export function tinhThongKe(
  orders: Order[],
  itemsByOrder: Map<string, OrderItem[]>,
  costByItem?: Map<string, number>,
): ThongKe {
  let soDon = 0;
  let doanhThu = 0;
  let tienHang = 0;
  let giaVon = 0;
  let soSanPham = 0;
  let donHuy = 0;
  let congNoCod = 0;

  for (const o of orders) {
    if (o.trang_thai === "huy" || o.trang_thai === "hoan") {
      donHuy += 1;
      continue;
    }
    if (o.trang_thai === "dang_giao" && o.thanh_toan === "cod") {
      congNoCod += Number(o.tong_tien);
    }
    if (!laDoanhThu(o.trang_thai)) continue;

    soDon += 1;
    doanhThu += Number(o.tong_tien);
    tienHang += Number(o.tam_tinh);

    for (const it of itemsByOrder.get(o.id) ?? []) {
      soSanPham += Number(it.so_luong);
      if (costByItem) giaVon += (costByItem.get(it.id) ?? 0) * Number(it.so_luong);
    }
  }

  return {
    soDon,
    doanhThu,
    tienHang,
    giaVon,
    loiNhuan: costByItem ? tienHang - giaVon : 0,
    soSanPham,
    giaTriTB: soDon ? Math.round(doanhThu / soDon) : 0,
    donHuy,
    congNoCod,
  };
}

/** Doanh thu gộp theo 1 khoá bất kỳ (kênh, cửa hàng, ngày…). */
export function gopDoanhThu<K extends string>(
  orders: Order[],
  key: (o: Order) => K,
): { label: K; doanhThu: number; soDon: number }[] {
  const map = new Map<K, { doanhThu: number; soDon: number }>();
  for (const o of orders) {
    if (!laDoanhThu(o.trang_thai)) continue;
    const k = key(o);
    const cur = map.get(k) ?? { doanhThu: 0, soDon: 0 };
    cur.doanhThu += Number(o.tong_tien);
    cur.soDon += 1;
    map.set(k, cur);
  }
  return [...map.entries()].map(([label, v]) => ({ label, ...v }));
}

export type TopSku = {
  variant_id: string;
  sku: string;
  ten: string;
  soLuong: number;
  doanhThu: number;
};

export function topSanPham(
  orders: Order[],
  items: OrderItem[],
  limit = 10,
): TopSku[] {
  const okOrders = new Set(orders.filter((o) => laDoanhThu(o.trang_thai)).map((o) => o.id));
  const map = new Map<string, TopSku>();

  for (const it of items) {
    if (!okOrders.has(it.order_id)) continue;
    const k = it.variant_id ?? it.sku ?? "?";
    const cur = map.get(k) ?? {
      variant_id: it.variant_id ?? "",
      sku: it.sku ?? "—",
      ten: it.ten_hien_thi ?? it.sku ?? "—",
      soLuong: 0,
      doanhThu: 0,
    };
    cur.soLuong += Number(it.so_luong);
    cur.doanhThu += tienDongHang(it);
    map.set(k, cur);
  }

  return [...map.values()].sort((a, b) => b.soLuong - a.soLuong).slice(0, limit);
}

/** Doanh thu từng ngày trong khoảng, điền 0 cho ngày không có đơn. */
export function doanhThuTheoNgay(
  orders: Order[],
  tu: Date,
  den: Date,
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!laDoanhThu(o.trang_thai)) continue;
    const k = ngayLocal(new Date(o.ngay_dat));
    map.set(k, (map.get(k) ?? 0) + Number(o.tong_tien));
  }

  const out: { label: string; value: number }[] = [];
  const cur = new Date(tu.getFullYear(), tu.getMonth(), tu.getDate());
  while (cur < den) {
    const k = ngayLocal(cur);
    out.push({ label: k, value: map.get(k) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Chuẩn hoá SĐT Việt Nam: bỏ ký tự thừa, +84 → 0. */
export function chuanHoaSdt(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  return s;
}

export const KENH_TU_KENH_MAP: Record<string, Kenh> = {
  shopee: "shopee",
  tiktok: "tiktok",
  facebook: "facebook",
  website: "website",
  store: "store",
};
