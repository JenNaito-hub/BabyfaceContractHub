import { tachDiaChi, doTinh, doQuan } from "../src/lib/sales/address";
import { parseSo, parseNgay, mapTrangThai } from "../src/lib/sales/importers";
import { chuanHoaSdt } from "../src/lib/sales/calc";
import { doiSoat, tuDongMapCod } from "../src/lib/sales/cod";
import type { Order } from "../src/lib/sales/types";

let fail = 0;
function eq(ten: string, thuc: unknown, mong: unknown) {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong);
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${ten}\n     nhận: ${JSON.stringify(thuc)}${ok ? "" : `\n     mong: ${JSON.stringify(mong)}`}`);
}

console.log("=== tách địa chỉ từ inbox ===");
const a = tachDiaChi("Nguyễn Thị Anh\n0901234567\n123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM");
eq("tên", a.ho_ten, "Nguyễn Thị Anh");
eq("sđt", a.sdt, "0901234567");
eq("tỉnh", a.tinh, "TP. Hồ Chí Minh");

const b = tachDiaChi("Tên: Trần B - SĐT: 0987.654.321 - ĐC: 45 Cầu Giấy, Quận Cầu Giấy, Hà Nội");
eq("sđt có dấu chấm", b.sdt, "0987654321");
eq("tỉnh Hà Nội", b.tinh, "Hà Nội");
eq("quận", b.quan, "Quận Cầu Giấy");

const c = tachDiaChi("chị Hoa 84912345678 số 7 ngõ 3 Thanh Xuân, Hà Nội");
eq("sđt +84 -> 0", c.sdt, "0912345678");

console.log("\n=== dò tỉnh ===");
eq("hcm viết tắt", doTinh("số 5 đường ABC, q7, hcm"), "TP. Hồ Chí Minh");
eq("đà nẵng", doTinh("12 Bạch Đằng, Hải Châu, Đà Nẵng"), "Đà Nẵng");
eq("lấy tỉnh ở cuối", doTinh("ngõ Hà Nội, Thanh Hoá"), "Thanh Hoá");
eq("không có tỉnh", doTinh("số 5 ngõ 3"), "");
eq("không khớp nhầm 'dn' trong từ", doTinh("đường Bùi Viện"), "");

console.log("\n=== dò quận ===");
eq("Q.1 -> Quận 1", doQuan("123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM"), "Quận 1");
eq("huyện", doQuan("thôn 2, Huyện Củ Chi, TP.HCM"), "Huyện Củ Chi");

console.log("\n=== parse số tiền ===");
eq("1.234.567 đ", parseSo("1.234.567 đ"), 1234567);
eq("1,234,567", parseSo("1,234,567"), 1234567);
eq("890000", parseSo("890000"), 890000);
eq("45000.50", parseSo("45000.50"), 45001);
eq("rỗng", parseSo(""), 0);
eq("có chữ", parseSo("Tổng: 2.480.000đ"), 2480000);

console.log("\n=== parse ngày ===");
eq("dd/mm/yyyy", parseNgay("15/08/2026")?.slice(0, 10), "2026-08-15");
eq("dd-mm-yyyy hh:mm", parseNgay("01-02-2026 14:30")?.slice(0, 10), "2026-02-01");
eq("rỗng", parseNgay(""), null);
eq("rác", parseNgay("abc"), null);

console.log("\n=== map trạng thái sàn ===");
eq("đã giao", mapTrangThai("Đã giao"), "hoan_thanh");
eq("cancelled", mapTrangThai("Cancelled"), "huy");
eq("shipping", mapTrangThai("Shipping"), "dang_giao");
eq("hoàn", mapTrangThai("Trả hàng/Hoàn tiền"), "hoan");
eq("rỗng", mapTrangThai(""), "moi");

console.log("\n=== chuẩn hoá sđt ===");
eq("+84", chuanHoaSdt("+84901234567"), "0901234567");
eq("có khoảng trắng", chuanHoaSdt("090 123 45 67"), "0901234567");


console.log("\n=== đối soát COD ===");
const donMau = (p: Partial<Order>): Order =>
  ({ id: "x", ma_don: "AE1", tong_tien: 500000, ma_van_don: "S1.A1", ngay_doi_soat: null, ...p }) as Order;

const sheet = {
  headers: ["Mã vận đơn", "Tiền thu hộ"],
  rows: [
    { "Mã vận đơn": "S1.A1", "Tiền thu hộ": "500.000" },
    { "Mã vận đơn": "S1.A2", "Tiền thu hộ": "300.000" },
    { "Mã vận đơn": "LA-LAC", "Tiền thu hộ": "99.000" },
    { "Mã vận đơn": "S1.A1", "Tiền thu hộ": "500.000" },
  ],
};
const map = tuDongMapCod(sheet.headers);
eq("tự đoán cột", map, { ma_van_don: "Mã vận đơn", so_tien: "Tiền thu hộ" });

const kq = doiSoat(sheet, map, [
  donMau({ id: "1", ma_van_don: "S1.A1", tong_tien: 500000 }),
  donMau({ id: "2", ma_van_don: "S1.A2", tong_tien: 350000 }),
]);
eq("bỏ dòng trùng mã", kq.length, 3);
eq("khớp đúng tiền", kq[0].trang_thai, "khop");
eq("lệch tiền", [kq[1].trang_thai, kq[1].lech], ["lech", -50000]);
eq("mã lạ", kq[2].trang_thai, "khong_thay");

const kq2 = doiSoat(sheet, map, [
  donMau({ id: "1", ma_van_don: "S1.A1", ngay_doi_soat: "2026-08-01" }),
]);
eq("đã đối soát trước đó", kq2[0].trang_thai, "da_doi_soat");

console.log(fail === 0 ? "\nTẤT CẢ PASS" : `\n${fail} TEST FAIL`);
process.exit(fail === 0 ? 0 : 1);
