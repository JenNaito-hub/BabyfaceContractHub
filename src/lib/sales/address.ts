import { chuanHoaSdt } from "./calc";

export type DiaChiTach = {
  ho_ten: string;
  sdt: string;
  dia_chi: string;
};

const PHONE_RE = /(?:\+?84|0)(?:[\s.-]?\d){8,10}/g;

/**
 * Tách khối text khách dán trong inbox (Facebook/Zalo) thành tên - SĐT - địa chỉ.
 * Chấp nhận cả 1 dòng lẫn nhiều dòng, có/không nhãn "SĐT:", "Tên:".
 */
export function tachDiaChi(raw: string): DiaChiTach {
  const text = String(raw ?? "").trim();
  if (!text) return { ho_ten: "", sdt: "", dia_chi: "" };

  // 1. SĐT — lấy số hợp lệ đầu tiên (9–11 chữ số sau khi chuẩn hoá)
  let sdt = "";
  for (const m of text.match(PHONE_RE) ?? []) {
    const norm = chuanHoaSdt(m);
    if (norm.length >= 9 && norm.length <= 11) {
      sdt = norm;
      break;
    }
  }

  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.replace(/^\s*(tên|ten|name|họ tên|ho ten|sđt|sdt|phone|số đt|địa chỉ|dia chi|đc)\s*[:.-]\s*/i, ""))
    .map((l) => l.trim())
    .filter(Boolean);

  const conLai = lines
    .map((l) => (sdt ? l.replace(PHONE_RE, "").replace(/\s{2,}/g, " ").trim() : l))
    .filter(Boolean);

  // 2. Địa chỉ = dòng dài nhất có dấu hiệu địa chỉ (số nhà, phường/quận/tỉnh…)
  const diaChiRe = /(đường|duong|phường|phuong|quận|quan|huyện|huyen|xã|xa|thị trấn|tỉnh|tinh|tp|thành phố|hcm|hà nội|ha noi|\d+\/?\d*\s)/i;
  const ungVien = conLai.filter((l) => diaChiRe.test(l));
  const dia_chi = (ungVien.length ? ungVien : conLai).sort((a, b) => b.length - a.length)[0] ?? "";

  // 3. Tên = dòng còn lại ngắn, không phải địa chỉ, không chứa số
  const ho_ten =
    conLai.find((l) => l !== dia_chi && !/\d/.test(l) && l.length <= 40) ??
    conLai.find((l) => l !== dia_chi) ??
    "";

  return { ho_ten, sdt, dia_chi };
}
