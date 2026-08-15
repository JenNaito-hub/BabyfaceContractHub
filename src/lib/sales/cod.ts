import { parseNgay, parseSo, type ParsedSheet } from "./importers";
import type { Order } from "./types";

/** Các trường cần map từ file đối soát của hãng vận chuyển. */
export const COD_FIELDS = [
  { key: "ma_van_don", label: "Mã vận đơn", required: true },
  { key: "so_tien", label: "Số tiền COD hãng trả", required: true },
  { key: "ngay", label: "Ngày đối soát", required: false },
] as const;

export type CodField = (typeof COD_FIELDS)[number]["key"];
export type CodMapping = Partial<Record<CodField, string>>;

const GOI_Y: Record<CodField, string[]> = {
  ma_van_don: ["mã vận đơn", "mã đơn hàng", "tracking", "order code", "mã bill", "mã phiếu gửi"],
  so_tien: [
    "tiền thu hộ",
    "cod",
    "số tiền cod",
    "tiền cod",
    "thực thu",
    "số tiền chuyển khoản",
    "thanh toán",
  ],
  ngay: ["ngày đối soát", "ngày thanh toán", "ngày chuyển khoản", "ngày"],
};

export function tuDongMapCod(headers: string[]): CodMapping {
  const norm = headers.map((h) => ({ raw: h, low: h.toLowerCase().trim() }));
  const out: CodMapping = {};
  for (const [field, ungVien] of Object.entries(GOI_Y) as [CodField, string[]][]) {
    const hit =
      norm.find((h) => ungVien.some((c) => h.low === c)) ??
      norm.find((h) => ungVien.some((c) => h.low.includes(c)));
    if (hit) out[field] = hit.raw;
  }
  return out;
}

export type DongDoiSoat = {
  ma_van_don: string;
  so_tien: number;
  ngay: string | null;
  order: Order | null;
  /** Chênh lệch giữa tiền hãng trả và tổng đơn (0 = khớp). */
  lech: number;
  trang_thai: "khop" | "lech" | "khong_thay" | "da_doi_soat";
};

/**
 * Ghép từng dòng trong file đối soát với đơn hàng theo mã vận đơn.
 * Không tự sửa gì — chỉ phân loại để người dùng quyết định.
 */
export function doiSoat(
  sheet: ParsedSheet,
  mapping: CodMapping,
  orders: Order[],
): DongDoiSoat[] {
  const byVanDon = new Map<string, Order>();
  for (const o of orders) {
    if (o.ma_van_don) byVanDon.set(o.ma_van_don.trim().toLowerCase(), o);
  }

  const out: DongDoiSoat[] = [];
  const daThay = new Set<string>();

  for (const row of sheet.rows) {
    const ma = String(mapping.ma_van_don ? (row[mapping.ma_van_don] ?? "") : "").trim();
    if (!ma || daThay.has(ma.toLowerCase())) continue;
    daThay.add(ma.toLowerCase());

    const soTien = parseSo(mapping.so_tien ? row[mapping.so_tien] : "");
    const ngay = mapping.ngay ? parseNgay(row[mapping.ngay]) : null;
    const order = byVanDon.get(ma.toLowerCase()) ?? null;

    let trang_thai: DongDoiSoat["trang_thai"];
    let lech = 0;

    if (!order) {
      trang_thai = "khong_thay";
    } else if (order.ngay_doi_soat) {
      trang_thai = "da_doi_soat";
    } else {
      lech = soTien - Number(order.tong_tien);
      trang_thai = lech === 0 ? "khop" : "lech";
    }

    out.push({ ma_van_don: ma, so_tien: soTien, ngay, order, lech, trang_thai });
  }

  return out;
}
