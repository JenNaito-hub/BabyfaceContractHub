/**
 * Đọc file đơn hàng xuất từ sàn (Shopee, TikTok Shop, …) và tách địa chỉ.
 *
 * Gói này KHÔNG chạm database và KHÔNG import React: chỉ là hàm thuần, nhận
 * vào file/chuỗi và trả về dữ liệu. Nhờ vậy chạy được cả ở trình duyệt (xem
 * trước khi nhập) lẫn ở server (nhập thật), và test được mà không cần dựng gì.
 */
export * from "./types.ts";
export * from "./phone.ts";
export * from "./address.ts";
export * from "./importers.ts";
