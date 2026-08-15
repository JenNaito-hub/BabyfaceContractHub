/**
 * Hằng số và nhãn tiếng Việt cho đơn hàng.
 *
 * Tệp này KHÔNG được import database hay bất cứ thứ gì chạy riêng ở server —
 * giao diện phía trình duyệt import trực tiếp vào đây. Nếu để chung với
 * `index.ts` thì webpack kéo cả `postgres.js` vào bundle client và build hỏng.
 */

export const TRANG_THAI_DON = [
  "new",
  "confirmed",
  "shipping",
  "completed",
  "cancelled",
  "returned",
] as const;
export type TrangThaiDon = (typeof TRANG_THAI_DON)[number];

export const NHAN_TRANG_THAI: Record<TrangThaiDon, string> = {
  new: "Mới",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Huỷ",
  returned: "Hoàn hàng",
};

export const NHAN_KENH: Record<string, string> = {
  store: "Cửa hàng",
  shopee: "Shopee",
  tiktok: "TikTok Shop",
  facebook: "Facebook / Zalo",
  website: "Website",
  b2b: "B2B",
  event: "Sự kiện",
};

export const NHAN_THANH_TOAN: Record<string, string> = {
  unpaid: "Chưa thu",
  cod: "COD",
  paid: "Đã thanh toán",
};

/** Chỉ đơn hoàn thành mới tính vào doanh thu. */
export const TINH_DOANH_THU: TrangThaiDon[] = ["completed"];

/** Trạng thái nào được phép chuyển sang trạng thái nào. */
export const CHUYEN_TRANG_THAI: Record<TrangThaiDon, TrangThaiDon[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipping", "completed", "cancelled"],
  shipping: ["completed", "returned", "cancelled"],
  completed: ["returned"],
  cancelled: [],
  returned: [],
};
