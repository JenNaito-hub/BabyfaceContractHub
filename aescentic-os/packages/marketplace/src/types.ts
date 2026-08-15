/**
 * Kiểu dùng chung cho phần đọc file sàn.
 *
 * Trạng thái ở đây dùng đúng từ vựng của AESCENTIC OS
 * (`new/confirmed/shipping/completed/cancelled/returned`) chứ không giữ bộ tên
 * cũ của app bán hàng đầu tiên — hai bộ tên song song là mầm mống sai lệch.
 */
export type Kenh = "shopee" | "tiktok" | "facebook" | "website" | "store";

export type TrangThaiDon =
  | "new"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | "returned";
