/**
 * Đọc file đối soát COD của hãng vận chuyển.
 *
 * Mỗi hãng đặt tên cột một kiểu ("Tiền thu hộ", "COD", "Thực thu"…) nên phải
 * đoán rồi cho người dùng sửa lại, y như phần nhập đơn từ sàn.
 *
 * Hàm ở đây chỉ PHÂN LOẠI, không tự sửa gì. Quyết định ghi nhận hay không là
 * của người đối soát — máy đoán sai mà tự chốt thì tiền sai mà không ai biết.
 */
import { parseNgay, parseSo, type ParsedSheet } from "./importers.ts";

export const COD_FIELDS = [
  { key: "ma_van_don", label: "Mã vận đơn", required: true },
  { key: "so_tien", label: "Số tiền hãng trả", required: true },
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

/** Đơn hàng tối giản mà phần đối soát cần biết. */
export type DonDeDoiSoat = {
  id: string;
  code: string;
  total: number;
  trackingCode: string | null;
  customerName: string | null;
  daDoiSoat: boolean;
};

export type TrangThaiDoiSoat = "khop" | "lech" | "khong_thay" | "da_doi_soat";

export type DongDoiSoat = {
  maVanDon: string;
  soTien: number;
  ngay: string | null;
  don: DonDeDoiSoat | null;
  /** Tiền hãng trả − tổng đơn. Dương là hãng trả dư, âm là trả thiếu. */
  lech: number;
  trangThai: TrangThaiDoiSoat;
};

/**
 * Ghép từng dòng trong file với đơn hàng theo mã vận đơn.
 *
 * Dòng trùng mã vận đơn bị bỏ qua: file của hãng hay lặp dòng khi một kiện đi
 * qua nhiều bưu cục, cộng hai lần là tiền tự nhiên nở ra.
 */
export function doiSoat(
  sheet: ParsedSheet,
  mapping: CodMapping,
  dons: DonDeDoiSoat[],
): DongDoiSoat[] {
  const theoVanDon = new Map<string, DonDeDoiSoat>();
  for (const d of dons) {
    if (d.trackingCode) theoVanDon.set(d.trackingCode.trim().toLowerCase(), d);
  }

  const out: DongDoiSoat[] = [];
  const daThay = new Set<string>();

  for (const row of sheet.rows) {
    const ma = String(mapping.ma_van_don ? (row[mapping.ma_van_don] ?? "") : "").trim();
    if (!ma || daThay.has(ma.toLowerCase())) continue;
    daThay.add(ma.toLowerCase());

    const soTien = parseSo(mapping.so_tien ? row[mapping.so_tien] : "");
    const ngay = mapping.ngay ? parseNgay(row[mapping.ngay]) : null;
    const don = theoVanDon.get(ma.toLowerCase()) ?? null;

    let trangThai: TrangThaiDoiSoat;
    let lech = 0;

    if (!don) {
      trangThai = "khong_thay";
    } else if (don.daDoiSoat) {
      trangThai = "da_doi_soat";
    } else {
      lech = soTien - Number(don.total);
      trangThai = lech === 0 ? "khop" : "lech";
    }

    out.push({ maVanDon: ma, soTien, ngay, don, lech, trangThai });
  }

  return out;
}

export const NHAN_DOI_SOAT: Record<TrangThaiDoiSoat, string> = {
  khop: "Khớp",
  lech: "Lệch tiền",
  khong_thay: "Không có đơn",
  da_doi_soat: "Đã đối soát trước",
};
