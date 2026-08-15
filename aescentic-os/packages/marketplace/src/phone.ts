/**
 * Chuẩn hoá số điện thoại Việt Nam về dạng bắt đầu bằng 0.
 *
 * Cùng một khách, Shopee xuất `+84901234567`, TikTok xuất `84901234567`, nhân
 * viên gõ tay `090 123 4567`. Không chuẩn hoá thì mỗi lần nhập lại sinh ra một
 * khách mới và lịch sử mua hàng vỡ vụn.
 */
export function chuanHoaSdt(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  return s;
}
