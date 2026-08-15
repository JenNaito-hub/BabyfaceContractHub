export type Kenh = "shopee" | "tiktok" | "facebook" | "website" | "store";

export type TrangThaiDon =
  | "moi"
  | "da_xac_nhan"
  | "dang_giao"
  | "hoan_thanh"
  | "huy"
  | "hoan";

export type TrangThaiThanhToan = "chua" | "cod" | "da_thanh_toan";

export type NhomKhach = "le" | "si" | "vip";

export type Store = {
  id: string;
  ma: string;
  ten: string;
  loai: "store" | "warehouse";
  dia_chi: string | null;
  /** Tỉnh/thành và quận/huyện nơi lấy hàng — API hãng vận chuyển bắt buộc. */
  tinh: string | null;
  quan: string | null;
  sdt: string | null;
  active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  ten: string;
  dong_san_pham: string | null;
  mo_ta: string | null;
  active: boolean;
  created_at: string;
};

export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  ten_bien_the: string | null;
  dung_tich_ml: number | null;
  barcode: string | null;
  gia_ban: number;
  gia_si: number;
  ton_toi_thieu: number;
  /** Khối lượng cả hộp (gram) — dùng tính phí ship. 0 = dùng mặc định. */
  khoi_luong_gram: number;
  active: boolean;
  created_at: string;
};

/** Giá vốn — bảng riêng, RLS chỉ admin/manager đọc được. */
export type VariantCost = {
  variant_id: string;
  gia_von: number;
  updated_at: string;
};

export type VariantFull = Variant & {
  product: Pick<Product, "id" | "ten" | "dong_san_pham"> | null;
};

export type InventoryRow = {
  variant_id: string;
  store_id: string;
  so_luong: number;
  updated_at: string;
};

export type StockMove = {
  id: string;
  variant_id: string;
  store_id: string;
  delta: number;
  loai: string;
  ref_type: string | null;
  ref_id: string | null;
  ghi_chu: string | null;
  created_by: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  ho_ten: string;
  sdt: string | null;
  email: string | null;
  dia_chi: string | null;
  nhom: NhomKhach;
  ghi_chu: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  ma_don: string;
  kenh: Kenh;
  store_id: string;
  customer_id: string | null;
  khach_ten: string | null;
  khach_sdt: string | null;
  dia_chi: string | null;
  tinh: string | null;
  quan: string | null;
  phuong: string | null;
  trang_thai: TrangThaiDon;
  thanh_toan: TrangThaiThanhToan;
  tam_tinh: number;
  giam_gia: number;
  phi_ship: number;
  tong_tien: number;
  don_vi_van_chuyen: string | null;
  ma_van_don: string | null;
  ma_don_san: string | null;
  ngay_dat: string;
  ghi_chu: string | null;
  da_tru_kho: boolean;
  /** Đơn lịch sử import từ sàn — tính doanh thu nhưng không đụng tồn kho. */
  bo_qua_kho: boolean;
  /** Số tiền COD hãng ship thực trả về, điền khi đối soát. */
  cod_da_thu: number | null;
  ngay_doi_soat: string | null;
  /** Trạng thái thô lấy từ API hãng vận chuyển. */
  trang_thai_ship: string | null;
  ship_cap_nhat_luc: string | null;
  created_by: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  variant_id: string | null;
  sku: string | null;
  ten_hien_thi: string | null;
  so_luong: number;
  don_gia: number;
  giam_gia: number;
  created_at: string;
};

export type OrderItemCost = {
  order_item_id: string;
  order_id: string;
  gia_von: number;
};

export type StockReceipt = {
  id: string;
  ma_phieu: string;
  store_id: string;
  nha_cung_cap: string | null;
  trang_thai: "nhap" | "hoan_thanh";
  ngay: string;
  ghi_chu: string | null;
  created_by: string | null;
  created_at: string;
};

export type ReceiptItem = {
  id: string;
  receipt_id: string;
  variant_id: string;
  so_luong: number;
  gia_nhap: number;
};

export type Transfer = {
  id: string;
  ma_phieu: string;
  from_store: string;
  to_store: string;
  trang_thai: "nhap" | "dang_chuyen" | "da_nhan" | "huy";
  ngay: string;
  ghi_chu: string | null;
  created_by: string | null;
  created_at: string;
};

export type TransferItem = {
  id: string;
  transfer_id: string;
  variant_id: string;
  so_luong: number;
};

/** Dòng hàng đang gõ trong POS / form tạo đơn (chưa lưu DB). */
export type CartLine = {
  variant_id: string;
  sku: string;
  ten_hien_thi: string;
  so_luong: number;
  don_gia: number;
  giam_gia: number;
  ton_kho: number;
};
