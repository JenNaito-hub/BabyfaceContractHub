/**
 * Nhãn tiếng Việt cho kho. Không import database — xem ghi chú ở
 * `modules/sales/src/labels.ts`.
 */

export const NHAN_LOAI_KHO: Record<string, string> = {
  sellable: "Hàng bán",
  tester: "Tester",
  gift: "Quà tặng",
  damaged: "Hàng hỏng",
  reserved: "Giữ chỗ",
  in_transit: "Đang chuyển",
};

export const NHAN_BIEN_DONG: Record<string, string> = {
  receipt: "Nhập kho",
  sale: "Bán ra",
  sale_return: "Hoàn kho",
  transfer_out: "Chuyển đi",
  transfer_in: "Chuyển đến",
  stock_count: "Kiểm kho",
  damage: "Hỏng",
  tester: "Tester",
  gift: "Quà tặng",
  sync: "Đồng bộ",
};
