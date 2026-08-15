export * from "./pos.ts";
export { NhanhProvider } from "./nhanh.ts";
export { MockPosProvider } from "./mock-pos.ts";

import { NhanhProvider } from "./nhanh.ts";
import { MockPosProvider } from "./mock-pos.ts";
import type { POSProvider } from "./pos.ts";

/**
 * Chọn adapter POS theo môi trường.
 *
 * Không có credential thì KHÔNG ném lỗi — chạy mock để phát triển và test tiếp
 * được. Nhưng phải báo rõ ra ngoài để admin health hiển thị, tuyệt đối không im
 * lặng giả vờ đã tích hợp.
 */
export function taoPosProvider(): { provider: POSProvider; laMock: boolean; lyDo: string } {
  const thieu = ["NHANH_APP_ID", "NHANH_BUSINESS_ID", "NHANH_ACCESS_TOKEN"].filter(
    (k) => !process.env[k],
  );

  if (thieu.length) {
    return {
      provider: new MockPosProvider(),
      laMock: true,
      lyDo: `Thiếu biến môi trường: ${thieu.join(", ")}`,
    };
  }

  return {
    provider: NhanhProvider.tuMoiTruong(),
    laMock: false,
    lyDo: "Đã cấu hình Nhanh.vn",
  };
}
