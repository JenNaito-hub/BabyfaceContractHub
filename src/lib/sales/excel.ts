import * as XLSX from "xlsx";
import { KENH_LABEL, THANH_TOAN_LABEL, TRANG_THAI_LABEL } from "./constants";
import {
  formatNgayGio,
  formatThang,
  gopDoanhThu,
  tienDongHang,
  tinhThongKe,
  topSanPham,
} from "./calc";
import type { Order, OrderItem, VariantFull } from "./types";

type ExportArgs = {
  thang: string;
  orders: Order[];
  items: OrderItem[];
  storeNames: Record<string, string>;
  /** Giá vốn theo order_item_id — chỉ manager mới truyền vào. */
  costByItem?: Map<string, number>;
};

/** Báo cáo bán hàng 1 tháng → .xlsx (client-side, SheetJS). */
export function xuatBaoCaoThang({ thang, orders, items, storeNames, costByItem }: ExportArgs) {
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const it of items) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id)!.push(it);
  }

  const stats = tinhThongKe(orders, itemsByOrder, costByItem);
  const wb = XLSX.utils.book_new();

  // 1 — Tổng quan
  const tongQuan: (string | number)[][] = [
    ["BÁO CÁO BÁN HÀNG — AESCENTIC", formatThang(thang)],
    [],
    ["Số đơn hoàn thành", stats.soDon],
    ["Doanh thu", stats.doanhThu],
    ["Tiền hàng (chưa gồm ship/giảm giá)", stats.tienHang],
  ];
  if (costByItem) {
    tongQuan.push(["Giá vốn", stats.giaVon], ["Lợi nhuận gộp", stats.loiNhuan]);
  }
  tongQuan.push(
    ["Số sản phẩm bán ra", stats.soSanPham],
    ["Giá trị đơn trung bình", stats.giaTriTB],
    ["Đơn huỷ / hoàn", stats.donHuy],
    ["COD đang trên đường", stats.congNoCod],
    ["Tổng số đơn trong kỳ", orders.length],
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tongQuan), "Tong quan");

  // 2 — Theo kênh
  const theoKenh = gopDoanhThu(orders, (o) => o.kenh).sort((a, b) => b.doanhThu - a.doanhThu);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Kênh", "Số đơn", "Doanh thu", "Tỷ trọng %"],
      ...theoKenh.map((r) => [
        KENH_LABEL[r.label] ?? r.label,
        r.soDon,
        r.doanhThu,
        stats.doanhThu ? Math.round((r.doanhThu / stats.doanhThu) * 100) : 0,
      ]),
    ]),
    "Theo kenh",
  );

  // 3 — Theo cửa hàng
  const theoStore = gopDoanhThu(orders, (o) => o.store_id).sort((a, b) => b.doanhThu - a.doanhThu);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Cửa hàng / Kho", "Số đơn", "Doanh thu"],
      ...theoStore.map((r) => [storeNames[r.label] ?? r.label, r.soDon, r.doanhThu]),
    ]),
    "Theo cua hang",
  );

  // 4 — Top sản phẩm
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["SKU", "Tên", "Số lượng bán", "Doanh thu"],
      ...topSanPham(orders, items, 100).map((r) => [r.sku, r.ten, r.soLuong, r.doanhThu]),
    ]),
    "Top san pham",
  );

  // 5 — Chi tiết đơn
  const donHeader = [
    "Mã đơn",
    "Ngày",
    "Kênh",
    "Cửa hàng",
    "Khách",
    "SĐT",
    "Trạng thái",
    "Thanh toán",
    "Tiền hàng",
    "Giảm giá",
    "Phí ship",
    "Tổng tiền",
    "Vận đơn",
    "Mã đơn sàn",
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      donHeader,
      ...orders.map((o) => [
        o.ma_don,
        formatNgayGio(o.ngay_dat),
        KENH_LABEL[o.kenh] ?? o.kenh,
        storeNames[o.store_id] ?? "",
        o.khach_ten ?? "",
        o.khach_sdt ?? "",
        TRANG_THAI_LABEL[o.trang_thai] ?? o.trang_thai,
        THANH_TOAN_LABEL[o.thanh_toan] ?? o.thanh_toan,
        o.tam_tinh,
        o.giam_gia,
        o.phi_ship,
        o.tong_tien,
        o.ma_van_don ?? "",
        o.ma_don_san ?? "",
      ]),
    ]),
    "Chi tiet don",
  );

  // 6 — Chi tiết dòng hàng
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const dongHeader = ["Mã đơn", "Ngày", "Kênh", "SKU", "Sản phẩm", "SL", "Đơn giá", "Thành tiền"];
  if (costByItem) dongHeader.push("Giá vốn", "Lãi gộp");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      dongHeader,
      ...items.map((it) => {
        const o = orderById.get(it.order_id);
        const thanhTien = tienDongHang(it);
        const row: (string | number)[] = [
          o?.ma_don ?? "",
          o ? formatNgayGio(o.ngay_dat) : "",
          o ? (KENH_LABEL[o.kenh] ?? o.kenh) : "",
          it.sku ?? "",
          it.ten_hien_thi ?? "",
          it.so_luong,
          it.don_gia,
          thanhTien,
        ];
        if (costByItem) {
          const von = (costByItem.get(it.id) ?? 0) * it.so_luong;
          row.push(von, thanhTien - von);
        }
        return row;
      }),
    ]),
    "Chi tiet dong hang",
  );

  XLSX.writeFile(wb, `aescentic-bao-cao-${thang}.xlsx`);
}

/** Xuất bảng tồn kho hiện tại theo từng cửa hàng. */
export function xuatTonKho(
  variants: VariantFull[],
  stores: { id: string; ten: string }[],
  tonKho: Map<string, number>, // key = `${variant_id}:${store_id}`
  costByVariant?: Map<string, number>,
) {
  const header = ["SKU", "Sản phẩm", "Biến thể", "Giá bán"];
  if (costByVariant) header.push("Giá vốn");
  header.push(...stores.map((s) => s.ten), "Tổng tồn");
  if (costByVariant) header.push("Giá trị tồn");

  const rows = variants.map((v) => {
    const perStore = stores.map((s) => tonKho.get(`${v.id}:${s.id}`) ?? 0);
    const tong = perStore.reduce((a, b) => a + b, 0);
    const row: (string | number)[] = [
      v.sku,
      v.product?.ten ?? "",
      v.ten_bien_the ?? "",
      v.gia_ban,
    ];
    if (costByVariant) row.push(costByVariant.get(v.id) ?? 0);
    row.push(...perStore, tong);
    if (costByVariant) row.push((costByVariant.get(v.id) ?? 0) * tong);
    return row;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Ton kho");
  XLSX.writeFile(wb, `aescentic-ton-kho-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
