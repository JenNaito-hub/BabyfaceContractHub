import { chuanHoaSdt } from "./calc";

export type DiaChiTach = {
  ho_ten: string;
  sdt: string;
  dia_chi: string;
  tinh: string;
  quan: string;
};

/**
 * 63 tỉnh/thành. Tên viết đúng như hãng vận chuyển dùng, kèm các cách viết tắt
 * khách hay gõ trong inbox.
 */
export const TINH_THANH: { ten: string; bi_danh: string[] }[] = [
  { ten: "TP. Hồ Chí Minh", bi_danh: ["hồ chí minh", "ho chi minh", "hcm", "tphcm", "sài gòn", "sai gon", "sg"] },
  { ten: "Hà Nội", bi_danh: ["hà nội", "ha noi", "hn"] },
  { ten: "Đà Nẵng", bi_danh: ["đà nẵng", "da nang", "dn"] },
  { ten: "Hải Phòng", bi_danh: ["hải phòng", "hai phong", "hp"] },
  { ten: "Cần Thơ", bi_danh: ["cần thơ", "can tho"] },
  { ten: "An Giang", bi_danh: ["an giang"] },
  { ten: "Bà Rịa - Vũng Tàu", bi_danh: ["bà rịa", "ba ria", "vũng tàu", "vung tau"] },
  { ten: "Bắc Giang", bi_danh: ["bắc giang", "bac giang"] },
  { ten: "Bắc Kạn", bi_danh: ["bắc kạn", "bac kan"] },
  { ten: "Bạc Liêu", bi_danh: ["bạc liêu", "bac lieu"] },
  { ten: "Bắc Ninh", bi_danh: ["bắc ninh", "bac ninh"] },
  { ten: "Bến Tre", bi_danh: ["bến tre", "ben tre"] },
  { ten: "Bình Định", bi_danh: ["bình định", "binh dinh"] },
  { ten: "Bình Dương", bi_danh: ["bình dương", "binh duong"] },
  { ten: "Bình Phước", bi_danh: ["bình phước", "binh phuoc"] },
  { ten: "Bình Thuận", bi_danh: ["bình thuận", "binh thuan"] },
  { ten: "Cà Mau", bi_danh: ["cà mau", "ca mau"] },
  { ten: "Cao Bằng", bi_danh: ["cao bằng", "cao bang"] },
  { ten: "Đắk Lắk", bi_danh: ["đắk lắk", "dak lak", "đăk lăk", "daklak"] },
  { ten: "Đắk Nông", bi_danh: ["đắk nông", "dak nong"] },
  { ten: "Điện Biên", bi_danh: ["điện biên", "dien bien"] },
  { ten: "Đồng Nai", bi_danh: ["đồng nai", "dong nai"] },
  { ten: "Đồng Tháp", bi_danh: ["đồng tháp", "dong thap"] },
  { ten: "Gia Lai", bi_danh: ["gia lai"] },
  { ten: "Hà Giang", bi_danh: ["hà giang", "ha giang"] },
  { ten: "Hà Nam", bi_danh: ["hà nam", "ha nam"] },
  { ten: "Hà Tĩnh", bi_danh: ["hà tĩnh", "ha tinh"] },
  { ten: "Hải Dương", bi_danh: ["hải dương", "hai duong"] },
  { ten: "Hậu Giang", bi_danh: ["hậu giang", "hau giang"] },
  { ten: "Hoà Bình", bi_danh: ["hoà bình", "hòa bình", "hoa binh"] },
  { ten: "Hưng Yên", bi_danh: ["hưng yên", "hung yen"] },
  { ten: "Khánh Hoà", bi_danh: ["khánh hoà", "khánh hòa", "khanh hoa", "nha trang"] },
  { ten: "Kiên Giang", bi_danh: ["kiên giang", "kien giang", "phú quốc", "phu quoc"] },
  { ten: "Kon Tum", bi_danh: ["kon tum", "kontum"] },
  { ten: "Lai Châu", bi_danh: ["lai châu", "lai chau"] },
  { ten: "Lâm Đồng", bi_danh: ["lâm đồng", "lam dong", "đà lạt", "da lat"] },
  { ten: "Lạng Sơn", bi_danh: ["lạng sơn", "lang son"] },
  { ten: "Lào Cai", bi_danh: ["lào cai", "lao cai", "sa pa", "sapa"] },
  { ten: "Long An", bi_danh: ["long an"] },
  { ten: "Nam Định", bi_danh: ["nam định", "nam dinh"] },
  { ten: "Nghệ An", bi_danh: ["nghệ an", "nghe an", "vinh"] },
  { ten: "Ninh Bình", bi_danh: ["ninh bình", "ninh binh"] },
  { ten: "Ninh Thuận", bi_danh: ["ninh thuận", "ninh thuan"] },
  { ten: "Phú Thọ", bi_danh: ["phú thọ", "phu tho"] },
  { ten: "Phú Yên", bi_danh: ["phú yên", "phu yen"] },
  { ten: "Quảng Bình", bi_danh: ["quảng bình", "quang binh"] },
  { ten: "Quảng Nam", bi_danh: ["quảng nam", "quang nam", "hội an", "hoi an"] },
  { ten: "Quảng Ngãi", bi_danh: ["quảng ngãi", "quang ngai"] },
  { ten: "Quảng Ninh", bi_danh: ["quảng ninh", "quang ninh", "hạ long", "ha long"] },
  { ten: "Quảng Trị", bi_danh: ["quảng trị", "quang tri"] },
  { ten: "Sóc Trăng", bi_danh: ["sóc trăng", "soc trang"] },
  { ten: "Sơn La", bi_danh: ["sơn la", "son la"] },
  { ten: "Tây Ninh", bi_danh: ["tây ninh", "tay ninh"] },
  { ten: "Thái Bình", bi_danh: ["thái bình", "thai binh"] },
  { ten: "Thái Nguyên", bi_danh: ["thái nguyên", "thai nguyen"] },
  { ten: "Thanh Hoá", bi_danh: ["thanh hoá", "thanh hóa", "thanh hoa"] },
  { ten: "Thừa Thiên Huế", bi_danh: ["thừa thiên", "thua thien", "huế", "hue"] },
  { ten: "Tiền Giang", bi_danh: ["tiền giang", "tien giang", "mỹ tho", "my tho"] },
  { ten: "Trà Vinh", bi_danh: ["trà vinh", "tra vinh"] },
  { ten: "Tuyên Quang", bi_danh: ["tuyên quang", "tuyen quang"] },
  { ten: "Vĩnh Long", bi_danh: ["vĩnh long", "vinh long"] },
  { ten: "Vĩnh Phúc", bi_danh: ["vĩnh phúc", "vinh phuc"] },
  { ten: "Yên Bái", bi_danh: ["yên bái", "yen bai"] },
];

/** Dò tỉnh/thành trong 1 đoạn text. Không chắc thì trả rỗng, không đoán bừa. */
export function doTinh(text: string): string {
  const low = text.toLowerCase();
  let ketQua = "";
  let viTri = -1;

  for (const t of TINH_THANH) {
    for (const bd of t.bi_danh) {
      // Bí danh ngắn (hcm, hn, dn) phải đứng riêng, tránh khớp nhầm trong từ khác
      const re = bd.length <= 3 ? new RegExp(`(^|[\\s,.-])${bd}([\\s,.]|$)`) : null;
      const idx = re ? low.search(re) : low.indexOf(bd);
      // Lấy khớp ở vị trí cuối cùng — địa chỉ VN viết tỉnh ở cuối
      if (idx >= 0 && idx > viTri) {
        viTri = idx;
        ketQua = t.ten;
      }
    }
  }
  return ketQua;
}

/**
 * Dò quận/huyện. Chỉ nhận cụm đứng đầu dòng hoặc ngay sau dấu phẩy — địa chỉ VN
 * luôn viết theo cấp, nên neo như vậy chính xác hơn là bắt tự do giữa câu.
 * Cụm nào thật ra là tên tỉnh (vd "TP.HCM") thì bỏ qua.
 */
export function doQuan(text: string): string {
  const re =
    /(?:^|[,\n])\s*((?:quận|quan|huyện|huyen|thị xã|thi xa|thành phố|thanh pho|tp\.?|q\.?\s*\d{1,2})[^,\n]{0,30})/gi;

  for (const m of text.matchAll(re)) {
    const raw = m[1].trim().replace(/\s+/g, " ").replace(/[.,]+$/, "");
    if (!raw) continue;

    // "Q.1" / "Q1" / "q 1" → "Quận 1"
    const so = raw.match(/^q\.?\s*(\d{1,2})$/i);
    if (so) return `Quận ${so[1]}`;

    // "TP.HCM", "TP. Hồ Chí Minh"… là tỉnh chứ không phải quận
    if (doTinh(raw)) continue;

    return raw;
  }
  return "";
}

/**
 * Dấu ngăn giữa các chữ số chỉ chấp nhận khoảng trắng thường / chấm / gạch —
 * KHÔNG dùng \s vì nó nuốt cả xuống dòng và dính luôn số nhà ở dòng sau.
 */
const PHONE_RE = /(?:\+?84|0)(?:[ .-]?\d){8,10}/g;

/**
 * Tách khối text khách dán trong inbox (Facebook/Zalo) thành tên - SĐT - địa chỉ.
 * Chấp nhận cả 1 dòng lẫn nhiều dòng, có/không nhãn "SĐT:", "Tên:".
 */
export function tachDiaChi(raw: string): DiaChiTach {
  const text = String(raw ?? "").trim();
  if (!text) return { ho_ten: "", sdt: "", dia_chi: "", tinh: "", quan: "" };

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

  return { ho_ten, sdt, dia_chi, tinh: doTinh(dia_chi), quan: doQuan(dia_chi) };
}
