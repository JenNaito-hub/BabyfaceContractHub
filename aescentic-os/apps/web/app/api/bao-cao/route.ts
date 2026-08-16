import { baoCaoDon, baoCaoSanPham, baoCaoTheoNgay, thongKe } from "@aescentic/sales";
import { bangTonKho } from "@aescentic/inventory";
import { taoExcel, type SheetBaoCao } from "@aescentic/marketplace";
import { authorize } from "@aescentic/permissions";
import { withAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Xuất báo cáo Excel.
 *
 * `?thang=YYYY-MM` — mặc định tháng hiện tại.
 *
 * Mọi số liệu đi qua đúng bộ lọc phạm vi của người tải: nhân viên một cửa hàng
 * tải file cũng chỉ ra dữ liệu cửa hàng đó, và không có cột giá vốn.
 */
export const GET = withAuth("order.read", async (ctx, _decision, req) => {
  const url = new URL(req.url);
  const now = new Date();
  const thang = /^\d{4}-\d{2}$/.test(url.searchParams.get("thang") ?? "")
    ? url.searchParams.get("thang")!
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [y, m] = thang.split("-").map(Number);
  const ky = { tuNgay: new Date(y!, m! - 1, 1), denNgay: new Date(y!, m!, 1) };
  const xemVon = authorize(ctx.principal, "product.cost").allowed;

  const [tk, dons, sanPham, theoNgay] = await Promise.all([
    thongKe(ctx, ky.tuNgay, ky.denNgay),
    baoCaoDon(ctx, ky),
    baoCaoSanPham(ctx, ky),
    baoCaoTheoNgay(ctx, ky),
  ]);

  const dauTrang = [
    `AESCENTIC — báo cáo tháng ${thang.split("-")[1]}/${thang.split("-")[0]}`,
    `Người xuất: ${ctx.fullName ?? ctx.email} · ${new Date().toLocaleString("vi-VN")}`,
    xemVon ? "" : "Tài khoản này không có quyền xem giá vốn — file không có cột lãi.",
  ].filter(Boolean);

  const sheets: SheetBaoCao[] = [
    {
      ten: "Tổng quan",
      ghiChu: dauTrang,
      cot: [
        { key: "chiTieu", nhan: "Chỉ tiêu" },
        { key: "giaTri", nhan: "Giá trị", kieu: "tien" },
      ],
      dong: [
        { chiTieu: "Doanh thu (đơn hoàn thành)", giaTri: tk.doanhThu },
        ...(tk.xemDuocLoiNhuan
          ? [
              { chiTieu: "Giá vốn hàng bán", giaTri: tk.giaVon },
              { chiTieu: "Lợi nhuận gộp", giaTri: tk.loiNhuan },
            ]
          : []),
        { chiTieu: "Số đơn hoàn thành", giaTri: tk.soDon },
        { chiTieu: "Số sản phẩm bán ra", giaTri: tk.soSanPham },
        { chiTieu: "Giá trị đơn trung bình", giaTri: tk.giaTriTB },
        { chiTieu: "Đơn cần xử lý", giaTri: tk.donCanXuLy },
        { chiTieu: "COD đang giao", giaTri: tk.codDangGiao },
      ],
    },
    {
      ten: "Theo ngày",
      cot: [
        { key: "ngay", nhan: "Ngày" },
        { key: "soDon", nhan: "Số đơn", kieu: "so" },
        { key: "doanhThu", nhan: "Doanh thu", kieu: "tien" },
      ],
      dong: theoNgay,
    },
    {
      ten: "Theo sản phẩm",
      cot: [
        { key: "sku", nhan: "SKU" },
        { key: "ten", nhan: "Tên sản phẩm" },
        { key: "soDon", nhan: "Số đơn", kieu: "so" },
        { key: "soLuong", nhan: "Số lượng", kieu: "so" },
        { key: "doanhThu", nhan: "Doanh thu", kieu: "tien" },
        ...(xemVon
          ? [
              { key: "giaVon", nhan: "Giá vốn", kieu: "tien" as const },
              { key: "laiGop", nhan: "Lãi gộp", kieu: "tien" as const },
              { key: "bienLai", nhan: "Biên lãi %", kieu: "so" as const },
            ]
          : []),
      ],
      dong: sanPham,
    },
    {
      ten: "Chi tiết đơn",
      cot: [
        { key: "code", nhan: "Mã đơn" },
        { key: "ngay", nhan: "Ngày" },
        { key: "kenh", nhan: "Kênh" },
        { key: "cuaHang", nhan: "Nơi bán" },
        { key: "khach", nhan: "Khách hàng" },
        { key: "sdt", nhan: "Điện thoại" },
        { key: "tinh", nhan: "Tỉnh/TP" },
        { key: "trangThai", nhan: "Trạng thái" },
        { key: "thanhToan", nhan: "Thanh toán" },
        { key: "tienHang", nhan: "Tiền hàng", kieu: "tien" },
        { key: "giamGia", nhan: "Giảm giá", kieu: "tien" },
        { key: "phiShip", nhan: "Phí ship", kieu: "tien" },
        { key: "tongTien", nhan: "Tổng tiền", kieu: "tien" },
        { key: "hangVanChuyen", nhan: "Hãng vận chuyển" },
        { key: "maVanDon", nhan: "Mã vận đơn" },
        { key: "maSan", nhan: "Mã đơn sàn" },
      ],
      dong: dons,
    },
  ];

  // Tồn kho chỉ đưa vào khi người tải có quyền xem kho
  if (authorize(ctx.principal, "inventory.read").allowed) {
    const bang = await bangTonKho(ctx);
    sheets.push({
      ten: "Tồn kho",
      cot: [
        { key: "skuCode", nhan: "SKU" },
        { key: "ten", nhan: "Sản phẩm" },
        { key: "tong", nhan: "Tồn", kieu: "so" },
        { key: "reorderPoint", nhan: "Ngưỡng", kieu: "so" },
        { key: "retailPrice", nhan: "Giá bán", kieu: "tien" },
        ...(xemVon
          ? [
              { key: "unitCost", nhan: "Giá vốn", kieu: "tien" as const },
              { key: "giaTri", nhan: "Giá trị tồn", kieu: "tien" as const },
            ]
          : []),
      ],
      dong: bang.map((r) => ({
        skuCode: r.skuCode,
        ten: `${r.productName} ${r.skuName ?? ""}`.trim(),
        tong: r.tong,
        reorderPoint: r.reorderPoint,
        retailPrice: r.retailPrice,
        unitCost: r.unitCost ?? 0,
        giaTri: (r.unitCost ?? 0) * r.tong,
      })),
    });
  }

  const buf = taoExcel(sheets);
  const ten = `aescentic-bao-cao-${thang}.xlsx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ten}"`,
      "Content-Length": String(buf.length),
      // Số liệu thay đổi liên tục, không cho trình duyệt giữ bản cũ
      "Cache-Control": "no-store",
    },
  });
});
