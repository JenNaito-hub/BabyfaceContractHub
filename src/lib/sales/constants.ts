import type { Kenh, NhomKhach, TrangThaiDon, TrangThaiThanhToan } from "./types";

export const KENH_LABEL: Record<Kenh, string> = {
  shopee: "Shopee",
  tiktok: "TikTok Shop",
  facebook: "Facebook / Zalo",
  website: "Website",
  store: "Cửa hàng",
};

export const KENH_LIST: Kenh[] = ["shopee", "tiktok", "facebook", "website", "store"];

/** Màu nhận diện từng kênh — dùng cho chart & badge. */
export const KENH_COLOR: Record<Kenh, string> = {
  shopee: "#E8553A",
  tiktok: "#1A1A1A",
  facebook: "#3B6BD6",
  website: "#8BAE00",
  store: "#D7F205",
};

export const TRANG_THAI_LABEL: Record<TrangThaiDon, string> = {
  moi: "Mới",
  da_xac_nhan: "Đã xác nhận",
  dang_giao: "Đang giao",
  hoan_thanh: "Hoàn thành",
  huy: "Huỷ",
  hoan: "Hoàn hàng",
};

export const TRANG_THAI_LIST: TrangThaiDon[] = [
  "moi",
  "da_xac_nhan",
  "dang_giao",
  "hoan_thanh",
  "huy",
  "hoan",
];

/** Trạng thái đã trừ kho — dùng để cảnh báo trước khi đổi. */
export const TRANG_THAI_TRU_KHO: TrangThaiDon[] = ["da_xac_nhan", "dang_giao", "hoan_thanh"];

/** Chỉ đơn hoàn thành mới tính vào doanh thu. */
export const TRANG_THAI_TINH_DOANH_THU: TrangThaiDon[] = ["hoan_thanh"];

export const THANH_TOAN_LABEL: Record<TrangThaiThanhToan, string> = {
  chua: "Chưa thu",
  cod: "COD",
  da_thanh_toan: "Đã thanh toán",
};

export const THANH_TOAN_LIST: TrangThaiThanhToan[] = ["chua", "cod", "da_thanh_toan"];

export const NHOM_KHACH_LABEL: Record<NhomKhach, string> = {
  le: "Khách lẻ",
  si: "Sỉ / Đại lý",
  vip: "VIP",
};

export const NHOM_KHACH_LIST: NhomKhach[] = ["le", "si", "vip"];

export const DON_VI_VAN_CHUYEN = [
  "GHTK",
  "GHN",
  "Viettel Post",
  "J&T Express",
  "Ninja Van",
  "SPX (Shopee Express)",
  "Grab / Ahamove",
  "Khách tự lấy",
];

export const LOAI_MOVE_LABEL: Record<string, string> = {
  nhap: "Nhập kho",
  ban: "Bán ra",
  tra: "Hoàn kho",
  chuyen_di: "Chuyển đi",
  chuyen_den: "Chuyển đến",
  kiem_ke: "Kiểm kho",
  huy: "Huỷ",
};
