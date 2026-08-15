import { inArray } from "drizzle-orm";
import { stores } from "@aescentic/database";
import { boLocRong } from "@aescentic/permissions";
import { batBuocQuyen } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Màn hình này là ví dụ chuẩn của việc áp bộ lọc phạm vi:
 * quyền không chỉ quyết định VÀO ĐƯỢC hay không, mà còn quyết định THẤY DÒNG NÀO.
 */
export default async function TrangCuaHang() {
  const { ctx, decision } = await batBuocQuyen("store.read");
  if (!decision.allowed) return null;

  const f = decision.filter;

  // Không có cửa hàng nào trong phạm vi → trả rỗng, tuyệt đối không rơi về "xem tất cả"
  if (boLocRong(f)) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Cửa hàng</h1>
        <p className="mt-2 text-muted">
          Tài khoản của bạn chưa được gán cửa hàng nào.
        </p>
      </div>
    );
  }

  const danhSach =
    f.kind === "all"
      ? await ctx.db.select().from(stores).orderBy(stores.code)
      : f.kind === "stores"
        ? await ctx.db.select().from(stores).where(inArray(stores.id, f.storeIds)).orderBy(stores.code)
        : [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Cửa hàng &amp; kho</h1>
      <p className="mt-1 text-sm text-muted">
        Bạn đang xem với phạm vi <strong>{decision.scope}</strong> — {danhSach.length} địa điểm.
      </p>

      <div className="mt-5 overflow-x-auto border border-line">
        <table className="w-full min-w-[600px] bg-surface">
          <thead>
            <tr>
              <th className="th">Mã</th>
              <th className="th">Tên</th>
              <th className="th">Loại</th>
              <th className="th">Địa chỉ</th>
              <th className="th">Nguồn</th>
            </tr>
          </thead>
          <tbody>
            {danhSach.map((s) => (
              <tr key={s.id}>
                <td className="td font-mono text-xs">{s.code}</td>
                <td className="td font-medium">{s.name}</td>
                <td className="td text-muted">
                  {s.kind === "warehouse" ? "Kho" : s.kind === "online" ? "Online" : "Cửa hàng"}
                </td>
                <td className="td text-muted">
                  {[s.address, s.district, s.province].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="td">
                  <span className="pill bg-line text-ink">{s.source}</span>
                </td>
              </tr>
            ))}
            {danhSach.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={5}>
                  Không có địa điểm nào trong phạm vi của bạn.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
