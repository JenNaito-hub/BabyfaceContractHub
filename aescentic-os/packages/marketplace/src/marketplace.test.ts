/**
 * Kiểm thử phần đọc file sàn và tách địa chỉ.
 *
 * Không cần database: toàn hàm thuần. Đây là những chỗ đã từng sai trong app
 * bán hàng đầu tiên và làm hỏng dữ liệu khách hàng, nên mỗi lỗi cũ đều có một
 * test riêng để không tái diễn.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { doQuan, doTinh, tachDiaChi } from "./address.ts";
import { chuanHoaSdt } from "./phone.ts";
import { dungDonHang, mapTrangThai, parseNgay, parseSo, tuDongMap } from "./importers.ts";
import { doiSoat, tuDongMapCod } from "./cod.ts";
import { taoExcel } from "./excel.ts";
import * as XLSX from "xlsx";

describe("tách địa chỉ dán từ inbox", () => {
  test("tách được tên, số điện thoại và tỉnh", () => {
    const a = tachDiaChi("Nguyễn Thị Anh\n0901234567\n123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM");
    assert.equal(a.ho_ten, "Nguyễn Thị Anh");
    assert.equal(a.sdt, "0901234567");
    assert.equal(a.tinh, "TP. Hồ Chí Minh");
  });

  test("số điện thoại có dấu chấm và nhãn 'Tên:/SĐT:/ĐC:'", () => {
    const b = tachDiaChi("Tên: Trần B - SĐT: 0987.654.321 - ĐC: 45 Cầu Giấy, Quận Cầu Giấy, Hà Nội");
    assert.equal(b.sdt, "0987654321");
    assert.equal(b.tinh, "Hà Nội");
    assert.equal(b.quan, "Quận Cầu Giấy");
  });

  test("số +84 đổi về 0", () => {
    assert.equal(tachDiaChi("chị Hoa 84912345678 số 7 ngõ 3 Thanh Xuân, Hà Nội").sdt, "0912345678");
  });

  test("số điện thoại không nuốt sang dòng sau", () => {
    // Lỗi cũ: regex dùng [\s.-] nên khớp cả xuống dòng, "0901234567\n123 Lê Lợi"
    // ra thành "09012345671" — sai một chữ số, gọi khách không được.
    const d = tachDiaChi("0901234567\n123 Lê Lợi, Q.1, TP.HCM");
    assert.equal(d.sdt, "0901234567");
  });
});

describe("dò tỉnh / quận", () => {
  test("nhận viết tắt và tên đầy đủ", () => {
    assert.equal(doTinh("số 5 đường ABC, q7, hcm"), "TP. Hồ Chí Minh");
    assert.equal(doTinh("12 Bạch Đằng, Hải Châu, Đà Nẵng"), "Đà Nẵng");
    assert.equal(doTinh("ngõ Hà Nội, Thanh Hoá"), "Thanh Hoá");
  });

  test("không có tỉnh thì trả rỗng, không đoán bừa", () => {
    assert.equal(doTinh("số 5 ngõ 3"), "");
    assert.equal(doTinh("đường Bùi Viện"), "");
  });

  test("quận trả về quận, không trả nhầm thành tỉnh", () => {
    // Lỗi cũ: "123 Lê Lợi, Q.1, TP.HCM" trả về "TP.HCM" thay vì "Quận 1".
    assert.equal(doQuan("123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM"), "Quận 1");
    assert.equal(doQuan("thôn 2, Huyện Củ Chi, TP.HCM"), "Huyện Củ Chi");
  });
});

describe("đọc số tiền", () => {
  test("nhận cả dấu chấm và dấu phẩy phân cách nghìn", () => {
    assert.equal(parseSo("1.234.567 đ"), 1234567);
    assert.equal(parseSo("1,234,567"), 1234567);
    assert.equal(parseSo("890000"), 890000);
  });

  test("phần thập phân làm tròn", () => {
    assert.equal(parseSo("45000.50"), 45001);
  });

  test("lẫn chữ vẫn lấy được số", () => {
    assert.equal(parseSo("Tổng: 2.480.000đ"), 2480000);
  });

  test("rỗng là 0, không phải NaN", () => {
    assert.equal(parseSo(""), 0);
    assert.equal(parseSo(null), 0);
  });
});

describe("đọc ngày", () => {
  test("dd/mm/yyyy đọc theo kiểu Việt Nam, không nhầm sang tháng/ngày", () => {
    assert.equal(parseNgay("15/08/2026")?.slice(0, 10), "2026-08-15");
    // 01/02 phải là 1 tháng 2, không phải 2 tháng 1
    assert.equal(parseNgay("01-02-2026 14:30")?.slice(0, 10), "2026-02-01");
  });

  test("không đọc được thì trả null, không trả ngày hôm nay", () => {
    assert.equal(parseNgay(""), null);
    assert.equal(parseNgay("abc"), null);
  });
});

describe("ánh xạ trạng thái sàn", () => {
  test('"Hoàn thành" là xong, KHÔNG phải hoàn hàng', () => {
    // Bẫy chữ: "hoàn thành" chứa "hoàn". Nếu xét nhầm thứ tự thì mọi đơn thành
    // công của Shopee bị nhập thành đơn trả hàng, doanh thu mất trắng.
    assert.equal(mapTrangThai("Hoàn thành"), "completed");
    assert.equal(mapTrangThai("Đã giao"), "completed");
    assert.equal(mapTrangThai("Delivered"), "completed");
  });

  test("trả hàng / hoàn tiền là returned", () => {
    assert.equal(mapTrangThai("Trả hàng/Hoàn tiền"), "returned");
    assert.equal(mapTrangThai("Refund"), "returned");
  });

  test("huỷ, đang giao, đã xác nhận", () => {
    assert.equal(mapTrangThai("Cancelled"), "cancelled");
    assert.equal(mapTrangThai("Shipping"), "shipping");
    assert.equal(mapTrangThai("Chờ lấy hàng"), "confirmed");
  });

  test("không biết thì để đơn mới, không đoán bừa", () => {
    assert.equal(mapTrangThai(""), "new");
    assert.equal(mapTrangThai("trạng thái lạ hoắc"), "new");
  });
});

describe("chuẩn hoá số điện thoại", () => {
  test("mọi cách viết về cùng một số", () => {
    const mong = "0901234567";
    for (const raw of ["+84901234567", "84901234567", "090 123 45 67", "090.123.4567", "0901234567"]) {
      assert.equal(chuanHoaSdt(raw), mong, `sai với "${raw}"`);
    }
  });
});

describe("tự đoán cột theo sàn", () => {
  test("đoán đúng tiêu đề tiếng Việt của Shopee", () => {
    const headers = [
      "Mã đơn hàng", "Ngày đặt hàng", "SKU phân loại hàng", "Tên sản phẩm",
      "Số lượng", "Giá ưu đãi", "Người nhận", "Số điện thoại",
      "Địa chỉ nhận hàng", "Mã vận đơn", "Trạng thái đơn hàng",
    ];
    const m = tuDongMap(headers, "shopee");
    assert.equal(m.ma_don_san, "Mã đơn hàng");
    assert.equal(m.sku, "SKU phân loại hàng");
    assert.equal(m.so_luong, "Số lượng");
    assert.equal(m.don_gia, "Giá ưu đãi");
    assert.equal(m.khach_sdt, "Số điện thoại");
  });

  test("đoán đúng tiêu đề tiếng Anh của TikTok Shop", () => {
    const m = tuDongMap(
      ["Order ID", "Created Time", "Seller SKU", "Quantity", "SKU Unit Original Price", "Phone #"],
      "tiktok",
    );
    assert.equal(m.ma_don_san, "Order ID");
    assert.equal(m.sku, "Seller SKU");
    assert.equal(m.khach_sdt, "Phone #");
  });
});

describe("gom dòng thành đơn", () => {
  const skuIndex = new Map([
    ["aes-001-50", { id: "sku-1", ten: "Amber Nuit 50ml" }],
    ["aes-002-50", { id: "sku-2", ten: "Amber Matin 50ml" }],
  ]);
  const mapping = {
    ma_don_san: "don", sku: "sku", so_luong: "sl", don_gia: "gia",
    khach_ten: "ten", khach_sdt: "sdt", phi_ship: "ship",
  } as const;

  test("nhiều dòng cùng mã đơn gộp thành một đơn nhiều sản phẩm", () => {
    const don = dungDonHang(
      [
        { don: "SP1", sku: "AES-001-50", sl: "2", gia: "1.290.000", ten: "Mai", sdt: "+84901234567", ship: "30.000" },
        { don: "SP1", sku: "AES-002-50", sl: "1", gia: "1.290.000", ten: "Mai", sdt: "+84901234567", ship: "30.000" },
        { don: "SP2", sku: "AES-001-50", sl: "1", gia: "1.290.000", ten: "Lan", sdt: "0912345678", ship: "0" },
      ],
      mapping,
      skuIndex,
    );

    assert.equal(don.length, 2);
    const sp1 = don.find((d) => d.ma_don_san === "SP1")!;
    assert.equal(sp1.items.length, 2);
    assert.equal(sp1.khach_sdt, "0901234567", "sđt phải được chuẩn hoá");
    // 2×1.290.000 + 1×1.290.000 + ship 30.000
    assert.equal(sp1.tong_tien, 3 * 1_290_000 + 30_000);
    assert.deepEqual(sp1.loi, []);
  });

  test("SKU lạ bị đánh dấu lỗi chứ không tự tạo sản phẩm mới", () => {
    const don = dungDonHang(
      [{ don: "SP3", sku: "KHONG-CO", sl: "1", gia: "100000" }],
      mapping,
      skuIndex,
    );
    assert.equal(don[0]!.items[0]!.variant_id, null);
    assert.match(don[0]!.loi.join(" "), /chưa có trong danh mục/);
  });

  test("thiếu mã đơn thì báo lỗi", () => {
    const don = dungDonHang([{ don: "", sku: "AES-001-50", sl: "1", gia: "1" }], mapping, skuIndex);
    assert.match(don[0]!.loi.join(" "), /Thiếu mã đơn/);
  });
});

describe("đối soát COD", () => {
  const dons = [
    { id: "o1", code: "AE01", total: 500_000, trackingCode: "S1.A1", customerName: "Mai", daDoiSoat: false },
    { id: "o2", code: "AE02", total: 350_000, trackingCode: "S1.A2", customerName: "Lan", daDoiSoat: false },
    { id: "o3", code: "AE03", total: 200_000, trackingCode: "S1.A3", customerName: "Hoa", daDoiSoat: true },
  ];

  const sheet = {
    headers: ["Mã vận đơn", "Tiền thu hộ"],
    rows: [
      { "Mã vận đơn": "S1.A1", "Tiền thu hộ": "500.000" },
      { "Mã vận đơn": "S1.A2", "Tiền thu hộ": "300.000" },
      { "Mã vận đơn": "LA-LAC", "Tiền thu hộ": "99.000" },
      { "Mã vận đơn": "S1.A3", "Tiền thu hộ": "200.000" },
      { "Mã vận đơn": "S1.A1", "Tiền thu hộ": "500.000" },
    ],
  };

  test("đoán được cột của hãng vận chuyển", () => {
    assert.deepEqual(tuDongMapCod(sheet.headers), {
      ma_van_don: "Mã vận đơn",
      so_tien: "Tiền thu hộ",
    });
  });

  test("dòng trùng mã vận đơn chỉ tính một lần", () => {
    // File của hãng hay lặp dòng khi kiện đi qua nhiều bưu cục. Cộng hai lần
    // là tiền tự nhiên nở ra mà không ai phát hiện.
    const kq = doiSoat(sheet, tuDongMapCod(sheet.headers), dons);
    assert.equal(kq.length, 4, "5 dòng nhưng 1 dòng trùng");
    assert.equal(kq.filter((r) => r.maVanDon === "S1.A1").length, 1);
  });

  test("phân loại đúng: khớp, lệch, không thấy, đã đối soát", () => {
    const kq = doiSoat(sheet, tuDongMapCod(sheet.headers), dons);
    const theoMa = new Map(kq.map((r) => [r.maVanDon, r]));

    assert.equal(theoMa.get("S1.A1")!.trangThai, "khop");
    assert.equal(theoMa.get("S1.A1")!.lech, 0);

    assert.equal(theoMa.get("S1.A2")!.trangThai, "lech");
    assert.equal(theoMa.get("S1.A2")!.lech, -50_000, "hãng trả thiếu 50k");

    assert.equal(theoMa.get("LA-LAC")!.trangThai, "khong_thay");
    assert.equal(theoMa.get("S1.A3")!.trangThai, "da_doi_soat");
  });

  test("hãng trả dư cũng bị bắt, không chỉ trả thiếu", () => {
    const kq = doiSoat(
      { headers: ["Mã vận đơn", "COD"], rows: [{ "Mã vận đơn": "S1.A1", COD: "600.000" }] },
      { ma_van_don: "Mã vận đơn", so_tien: "COD" },
      dons,
    );
    assert.equal(kq[0]!.trangThai, "lech");
    assert.equal(kq[0]!.lech, 100_000);
  });

  test("mã vận đơn hoa thường khác nhau vẫn khớp", () => {
    const kq = doiSoat(
      { headers: ["Mã vận đơn", "COD"], rows: [{ "Mã vận đơn": "  s1.a1  ", COD: "500000" }] },
      { ma_van_don: "Mã vận đơn", so_tien: "COD" },
      dons,
    );
    assert.equal(kq[0]!.trangThai, "khop");
  });
});

describe("xuất Excel", () => {
  const sheets = [
    {
      ten: "Tổng quan",
      ghiChu: ["AESCENTIC — báo cáo tháng 08/2026", "Người xuất: Jen"],
      cot: [
        { key: "chiTieu", nhan: "Chỉ tiêu" },
        { key: "giaTri", nhan: "Giá trị", kieu: "tien" as const },
      ],
      dong: [
        { chiTieu: "Doanh thu", giaTri: 156_580_000 },
        { chiTieu: "Lợi nhuận gộp", giaTri: 94_032_000 },
      ],
    },
    {
      ten: "Theo sản phẩm",
      cot: [
        { key: "sku", nhan: "SKU" },
        { key: "soLuong", nhan: "Số lượng", kieu: "so" as const },
      ],
      dong: [{ sku: "AES-001-50", soLuong: 12 }],
    },
  ];

  function docLai() {
    // `cellNF` để đọc lại được định dạng số — mặc định SheetJS bỏ qua nó khi
    // đọc, nên không có cờ này thì không kiểm được phần định dạng.
    return XLSX.read(taoExcel(sheets), { type: "buffer", cellNF: true });
  }

  test("file mở lại được và đủ sheet", () => {
    const wb = docLai();
    assert.deepEqual(wb.SheetNames, ["Tổng quan", "Theo sản phẩm"]);
  });

  test("số tiền vào Excel là SỐ, không phải chữ", () => {
    // Nếu ghi thành chuỗi thì người nhận không cộng được bằng SUM, mà cộng tay
    // là sai. Đây là lỗi hay gặp nhất khi xuất báo cáo.
    const ws = docLai().Sheets["Tổng quan"]!;
    // 2 dòng ghi chú + 1 dòng tiêu đề → dữ liệu bắt đầu ở dòng 4
    const o = ws["B4"];
    assert.equal(o.t, "n", "ô tiền phải là kiểu số");
    assert.equal(o.v, 156_580_000);
    assert.equal(o.z, "#,##0", "phải có định dạng phân cách nghìn");
  });

  test("ghi chú nằm trên bảng, không đè mất tiêu đề cột", () => {
    const ws = docLai().Sheets["Tổng quan"]!;
    assert.match(String(ws["A1"].v), /báo cáo tháng/);
    assert.equal(ws["A3"].v, "Chỉ tiêu");
    assert.equal(ws["B3"].v, "Giá trị");
  });

  test("sheet không có ghi chú thì tiêu đề ở dòng đầu", () => {
    const ws = docLai().Sheets["Theo sản phẩm"]!;
    assert.equal(ws["A1"].v, "SKU");
    assert.equal(ws["A2"].v, "AES-001-50");
    assert.equal(ws["B2"].t, "n");
  });

  test("tên sheet quá dài hoặc có ký tự cấm vẫn tạo được file", () => {
    // Excel cấm : \ / ? * [ ] và giới hạn 31 ký tự. Ném lỗi ở đây nghĩa là
    // người dùng bấm tải và nhận về trang lỗi.
    const wb = XLSX.read(
      taoExcel([
        {
          ten: "Báo cáo 01/08/2026 — chi tiết đơn hàng theo từng cửa hàng",
          cot: [{ key: "a", nhan: "A" }],
          dong: [{ a: 1 }],
        },
      ]),
      { type: "buffer" },
    );
    assert.equal(wb.SheetNames.length, 1);
    assert.ok(wb.SheetNames[0]!.length <= 31);
    assert.ok(!/[:\\/?*[\]]/.test(wb.SheetNames[0]!));
  });

  test("bảng rỗng vẫn ra file hợp lệ, không nổ", () => {
    const wb = XLSX.read(
      taoExcel([{ ten: "Rỗng", cot: [{ key: "a", nhan: "Cột A" }], dong: [] }]),
      { type: "buffer" },
    );
    assert.equal(wb.Sheets["Rỗng"]!["A1"].v, "Cột A");
  });
});
