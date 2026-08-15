import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Phiên đăng nhập — không phụ thuộc framework.
 *
 * Có hai nguồn danh tính:
 *   1. Supabase Auth (production) — cookie do Supabase quản, ta chỉ ánh xạ
 *      auth_user_id sang os.users.
 *   2. Dev session (chỉ local) — cookie ký HMAC, cho phép chọn tài khoản để
 *      chạy thử và test mà không cần dựng Supabase.
 *
 * Nguồn 2 BỊ KHOÁ CỨNG ở production, xem `devLoginDuocPhep()`.
 */

export const TEN_COOKIE = "aes_dev_session";
const HAN_MAC_DINH_GIAY = 60 * 60 * 8;

function khoa(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET phải có ít nhất 32 ký tự");
  }
  return s;
}

/**
 * Dev login chỉ bật khi CẢ HAI điều kiện đúng. Một biến môi trường đặt nhầm
 * không đủ để mở cửa trên production.
 */
export function devLoginDuocPhep(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
}

/** Gọi lúc khởi động: chết ngay còn hơn chạy production với cửa sau đang mở. */
export function kiemTraCauHinhAuth(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN === "true") {
    throw new Error(
      "ALLOW_DEV_LOGIN=true trên production. Đây là cửa sau đăng nhập — gỡ biến này ngay.",
    );
  }
}

function ky(payload: string): string {
  return createHmac("sha256", khoa()).update(payload).digest("base64url");
}

export function taoDevCookie(userId: string, hanGiay = HAN_MAC_DINH_GIAY): string {
  const het = Math.floor(Date.now() / 1000) + hanGiay;
  const payload = `${userId}.${het}`;
  return `${payload}.${ky(payload)}`;
}

/** Trả về userId nếu cookie hợp lệ và chưa hết hạn, ngược lại null. */
export function docDevCookie(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [userId, hetStr, chuKy] = parts as [string, string, string];
  const mong = ky(`${userId}.${hetStr}`);

  // So sánh theo thời gian hằng số để không rò rỉ thông tin qua thời gian phản hồi
  const a = Buffer.from(chuKy);
  const b = Buffer.from(mong);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const het = Number(hetStr);
  if (!Number.isFinite(het) || het * 1000 < Date.now()) return null;

  return userId;
}
