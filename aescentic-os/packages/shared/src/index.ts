/** Tiện ích dùng chung, không phụ thuộc framework. */

export function tienVND(n: number): string {
  return Math.round(n).toLocaleString("vi-VN") + " đ";
}

/** Chuẩn hoá SĐT Việt Nam về dạng 0xxxxxxxxx. Trả rỗng nếu không hợp lệ. */
export function chuanHoaSdt(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  return /^0\d{8,10}$/.test(s) ? s : "";
}

export function chiaLo<T>(items: T[], kichThuoc: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += kichThuoc) out.push(items.slice(i, i + kichThuoc));
  return out;
}

/** Thử lại với backoff tăng dần. Dùng cho gọi API bên ngoài. */
export async function thuLai<T>(
  fn: () => Promise<T>,
  opts: { lanToiDa?: number; treBanDauMs?: number } = {},
): Promise<T> {
  const lanToiDa = opts.lanToiDa ?? 4;
  const tre = opts.treBanDauMs ?? 500;
  let loiCuoi: unknown;

  for (let lan = 0; lan < lanToiDa; lan++) {
    try {
      return await fn();
    } catch (e) {
      loiCuoi = e;
      if (lan === lanToiDa - 1) break;
      await new Promise((r) => setTimeout(r, tre * 2 ** lan));
    }
  }
  throw loiCuoi;
}
