/**
 * Dựng file Excel nhiều sheet.
 *
 * Hàm thuần: nhận dữ liệu đã tính sẵn, trả về buffer. Không chạm database nên
 * test được mà không cần dựng gì, và dùng lại được ở cả worker lẫn route web.
 */
import * as XLSX from "xlsx";

export type CotBaoCao = {
  key: string;
  nhan: string;
  /** `tien` và `so` được căn phải và định dạng số kiểu Việt Nam. */
  kieu?: "chu" | "so" | "tien" | "ngay";
};

export type SheetBaoCao = {
  ten: string;
  cot: CotBaoCao[];
  dong: Record<string, unknown>[];
  /** Vài dòng ghi chú đặt trên bảng — dùng cho kỳ báo cáo, người xuất… */
  ghiChu?: string[];
};

/** Định dạng số của Excel. Tiền VND không có phần thập phân. */
const DINH_DANG: Record<string, string> = {
  tien: "#,##0",
  so: "#,##0",
  ngay: "dd/mm/yyyy hh:mm",
};

function doRong(cot: CotBaoCao, dong: Record<string, unknown>[]): number {
  const daiNhat = dong.reduce((m, r) => {
    const v = r[cot.key];
    const s = v instanceof Date ? 16 : String(v ?? "").length;
    return Math.max(m, s);
  }, cot.nhan.length);
  // Chặn trên để một ô ghi chú dài không làm cột rộng cả màn hình
  return Math.min(Math.max(daiNhat + 2, 10), 42);
}

export function taoSheet(s: SheetBaoCao): XLSX.WorkSheet {
  const ghiChu = s.ghiChu ?? [];
  const aoa: unknown[][] = [
    ...ghiChu.map((g) => [g]),
    s.cot.map((c) => c.nhan),
    ...s.dong.map((r) =>
      s.cot.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined) return "";
        // Số phải vào Excel dưới dạng số, không phải chuỗi — nếu không thì
        // người nhận không cộng được, mà cộng tay là sai.
        if (c.kieu === "tien" || c.kieu === "so") return Number(v);
        return v;
      }),
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const dongTieuDe = ghiChu.length;

  // Gắn định dạng số cho từng ô dữ liệu
  s.cot.forEach((c, i) => {
    const fmt = c.kieu ? DINH_DANG[c.kieu] : undefined;
    if (!fmt) return;
    for (let r = 0; r < s.dong.length; r++) {
      const dc = XLSX.utils.encode_cell({ c: i, r: dongTieuDe + 1 + r });
      const o = ws[dc];
      if (o && typeof o.v === "number") o.z = fmt;
    }
  });

  ws["!cols"] = s.cot.map((c) => ({ wch: doRong(c, s.dong) }));
  // Khoá dòng tiêu đề để cuộn xuống vẫn thấy tên cột
  ws["!freeze"] = { xSplit: 0, ySplit: dongTieuDe + 1 };
  if (s.dong.length) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: dongTieuDe },
        e: { c: s.cot.length - 1, r: dongTieuDe + s.dong.length },
      }),
    };
  }
  return ws;
}

/** Gộp nhiều sheet thành một file .xlsx và trả về buffer. */
export function taoExcel(sheets: SheetBaoCao[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    // Excel giới hạn tên sheet 31 ký tự và cấm : \ / ? * [ ]
    const ten = s.ten.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, taoSheet(s), ten);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
