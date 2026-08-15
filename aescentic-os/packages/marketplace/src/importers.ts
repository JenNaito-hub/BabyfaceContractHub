import * as XLSX from "xlsx";
import { chuanHoaSdt } from "./phone.ts";
import type { Kenh, TrangThaiDon } from "./types.ts";

/** Các trường đích mà file sàn cần map vào. */
export const IMPORT_FIELDS = [
  { key: "ma_don_san", label: "Mã đơn của sàn", required: true },
  { key: "ngay_dat", label: "Ngày đặt", required: false },
  { key: "sku", label: "SKU", required: true },
  { key: "ten_hien_thi", label: "Tên sản phẩm", required: false },
  { key: "so_luong", label: "Số lượng", required: true },
  { key: "don_gia", label: "Đơn giá", required: true },
  { key: "khach_ten", label: "Tên khách", required: false },
  { key: "khach_sdt", label: "SĐT khách", required: false },
  { key: "dia_chi", label: "Địa chỉ", required: false },
  { key: "phi_ship", label: "Phí ship", required: false },
  { key: "giam_gia", label: "Giảm giá (đơn)", required: false },
  { key: "ma_van_don", label: "Mã vận đơn", required: false },
  { key: "don_vi_van_chuyen", label: "Đơn vị vận chuyển", required: false },
  { key: "trang_thai_goc", label: "Trạng thái trên sàn", required: false },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<ImportField, string>>;

/**
 * Tên cột thường gặp trong file xuất của từng sàn. Dùng để tự đoán mapping —
 * sàn đổi tên cột thì vẫn map tay được, không hỏng.
 */
const PRESETS: Record<string, Partial<Record<ImportField, string[]>>> = {
  shopee: {
    ma_don_san: ["mã đơn hàng", "order id", "mã đơn"],
    ngay_dat: ["ngày đặt hàng", "thời gian đặt hàng", "order creation date"],
    sku: ["sku phân loại hàng", "sku sản phẩm", "sku", "mã sku"],
    ten_hien_thi: ["tên sản phẩm", "product name"],
    so_luong: ["số lượng", "quantity"],
    don_gia: ["giá ưu đãi", "giá gốc", "đơn giá", "deal price"],
    khach_ten: ["người nhận", "tên người mua", "người mua"],
    khach_sdt: ["số điện thoại", "sđt người nhận"],
    dia_chi: ["địa chỉ nhận hàng", "địa chỉ"],
    phi_ship: ["phí vận chuyển", "người mua trả phí vận chuyển"],
    ma_van_don: ["mã vận đơn", "tracking number"],
    don_vi_van_chuyen: ["đơn vị vận chuyển", "kênh vận chuyển"],
    trang_thai_goc: ["trạng thái đơn hàng", "order status"],
  },
  tiktok: {
    ma_don_san: ["order id", "mã đơn hàng", "order no"],
    ngay_dat: ["created time", "thời gian tạo", "order created time"],
    sku: ["seller sku", "sku id", "sku"],
    ten_hien_thi: ["product name", "tên sản phẩm"],
    so_luong: ["quantity", "số lượng"],
    don_gia: ["sku unit original price", "sku subtotal before discount", "đơn giá"],
    khach_ten: ["recipient", "buyer username", "tên người nhận"],
    khach_sdt: ["phone #", "phone", "số điện thoại"],
    dia_chi: ["detail address", "địa chỉ chi tiết", "địa chỉ"],
    phi_ship: ["shipping fee after discount", "phí vận chuyển"],
    ma_van_don: ["tracking id", "mã vận đơn"],
    don_vi_van_chuyen: ["shipping provider name", "đơn vị vận chuyển"],
    trang_thai_goc: ["order status", "order substatus", "trạng thái"],
  },
};

export type ParsedSheet = { headers: string[]; rows: Record<string, string>[] };

/** Đọc .xlsx/.xls/.csv thành mảng object, giữ nguyên text để tự parse sau. */
export async function docFile(file: File): Promise<ParsedSheet> {
  const laCsv = /\.(csv|txt)$/i.test(file.name) || (file.type ?? "").includes("csv");

  // CSV phải đọc bằng UTF-8. Để SheetJS tự đoán bảng mã thì tiêu đề tiếng Việt
  // biến thành "SKU phÃ¢n loáº¡i hÃ ng" và phần tự đoán cột hỏng hoàn toàn.
  const wb = laCsv
    ? XLSX.read((await file.text()).replace(/^﻿/, ""), { type: "string", raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: false });
  const tenSheet = wb.SheetNames[0];
  const sheet = tenSheet ? wb.Sheets[tenSheet] : undefined;
  if (!sheet) return { headers: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  // Dòng tiêu đề = dòng đầu tiên có >= 3 ô không rỗng (file sàn hay có dòng ghi chú ở trên)
  let headerRow = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const filled = (matrix[i] ?? []).filter((c) => String(c).trim() !== "").length;
    if (filled >= 3) {
      headerRow = i;
      break;
    }
  }

  const headers = (matrix[headerRow] ?? []).map((h) => String(h).trim());
  const rows: Record<string, string>[] = [];

  for (let i = headerRow + 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    if (raw.every((c) => String(c).trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = String(raw[idx] ?? "").trim();
    });
    rows.push(obj);
  }

  return { headers: headers.filter(Boolean), rows };
}

/** Đoán mapping từ tên cột có sẵn. */
export function tuDongMap(headers: string[], kenh: Kenh): Mapping {
  const preset = PRESETS[kenh] ?? {};
  const norm = headers.map((h) => ({ raw: h, low: h.toLowerCase().trim() }));
  const mapping: Mapping = {};

  for (const [field, candidates] of Object.entries(preset)) {
    const hit =
      norm.find((h) => candidates!.some((c) => h.low === c)) ??
      norm.find((h) => candidates!.some((c) => h.low.includes(c)));
    if (hit) mapping[field as ImportField] = hit.raw;
  }
  return mapping;
}

/** "1.234.567 đ" | "1,234,567" | "45000.5" → number */
export function parseSo(raw: string | null | undefined): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;

  let cleaned = s.replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  // Dấu thập phân = dấu phân cách xuất hiện SAU cùng và theo sau bởi 1-2 chữ số
  const decSep = lastComma > lastDot ? "," : lastDot > lastComma ? "." : "";
  if (decSep) {
    const idx = Math.max(lastComma, lastDot);
    const tail = cleaned.slice(idx + 1);
    if (tail.length <= 2 && /^\d+$/.test(tail)) {
      cleaned = cleaned.slice(0, idx).replace(/[.,]/g, "") + "." + tail;
    } else {
      cleaned = cleaned.replace(/[.,]/g, "");
    }
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Nhận cả ISO, dd/mm/yyyy, dd-mm-yyyy (kèm giờ). Không parse được → null. */
export function parseNgay(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const vn = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (vn) {
    const [, d = "1", m = "1", y = "1970", hh = "0", mm = "0", ss = "0"] = vn;
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss).toISOString();
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Ánh xạ trạng thái trên sàn → trạng thái của AESCENTIC OS.
 *
 * Thứ tự kiểm tra có chủ ý: "hoàn thành" phải xét TRƯỚC "hoàn (trả hàng)", vì
 * chuỗi "hoàn thành" cũng khớp với chữ "hoàn".
 */
export function mapTrangThai(raw: string | null | undefined): TrangThaiDon {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return "new";
  if (/(huỷ|hủy|cancel)/.test(s)) return "cancelled";
  if (/(hoàn thành|đã giao|delivered|completed)/.test(s)) return "completed";
  if (/(hoàn hàng|hoàn trả|trả hàng|return|refund)/.test(s)) return "returned";
  if (/(đang giao|shipping|in transit|shipped|to ship|chờ giao)/.test(s)) return "shipping";
  if (/(đã xác nhận|confirm|awaiting|chờ lấy hàng|processing)/.test(s)) return "confirmed";
  return "new";
}

export type DraftItem = {
  sku: string;
  ten_hien_thi: string;
  so_luong: number;
  don_gia: number;
  variant_id: string | null;
};

export type DraftOrder = {
  ma_don_san: string;
  ngay_dat: string | null;
  khach_ten: string;
  khach_sdt: string;
  dia_chi: string;
  phi_ship: number;
  giam_gia: number;
  ma_van_don: string;
  don_vi_van_chuyen: string;
  trang_thai: TrangThaiDon;
  items: DraftItem[];
  tong_tien: number;
  /** Lý do không import được — rỗng nghĩa là OK. */
  loi: string[];
};

/**
 * Gom các dòng cùng mã đơn thành 1 đơn nhiều dòng hàng, đối chiếu SKU với
 * danh mục hiện có. SKU lạ → đánh dấu lỗi để người dùng xử lý, không tự tạo.
 */
export function dungDonHang(
  rows: Record<string, string>[],
  mapping: Mapping,
  skuIndex: Map<string, { id: string; ten: string }>,
): DraftOrder[] {
  const get = (row: Record<string, string>, f: ImportField) =>
    mapping[f] ? (row[mapping[f]!] ?? "") : "";

  const byOrder = new Map<string, DraftOrder>();

  for (const row of rows) {
    const maDon = String(get(row, "ma_don_san")).trim();
    const sku = String(get(row, "sku")).trim();
    if (!maDon && !sku) continue;

    let order = byOrder.get(maDon);
    if (!order) {
      order = {
        ma_don_san: maDon,
        ngay_dat: parseNgay(get(row, "ngay_dat")),
        khach_ten: String(get(row, "khach_ten")).trim(),
        khach_sdt: chuanHoaSdt(get(row, "khach_sdt")),
        dia_chi: String(get(row, "dia_chi")).trim(),
        phi_ship: parseSo(get(row, "phi_ship")),
        giam_gia: parseSo(get(row, "giam_gia")),
        ma_van_don: String(get(row, "ma_van_don")).trim(),
        don_vi_van_chuyen: String(get(row, "don_vi_van_chuyen")).trim(),
        trang_thai: mapTrangThai(get(row, "trang_thai_goc")),
        items: [],
        tong_tien: 0,
        loi: [],
      };
      if (!maDon) order.loi.push("Thiếu mã đơn");
      byOrder.set(maDon, order);
    }

    const matched = skuIndex.get(sku.toLowerCase());
    const soLuong = Math.max(1, parseSo(get(row, "so_luong")) || 1);
    const donGia = parseSo(get(row, "don_gia"));

    order.items.push({
      sku,
      ten_hien_thi: String(get(row, "ten_hien_thi")).trim() || matched?.ten || sku,
      so_luong: soLuong,
      don_gia: donGia,
      variant_id: matched?.id ?? null,
    });

    if (!matched) order.loi.push(`SKU chưa có trong danh mục: ${sku || "(trống)"}`);
  }

  for (const o of byOrder.values()) {
    o.tong_tien =
      o.items.reduce((s, it) => s + it.so_luong * it.don_gia, 0) + o.phi_ship - o.giam_gia;
    o.loi = [...new Set(o.loi)];
  }

  return [...byOrder.values()];
}
