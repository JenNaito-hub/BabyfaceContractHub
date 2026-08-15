import { asc, eq, isNull } from "drizzle-orm";
import { roles, stores, userRoles, userStoreAssignments, users } from "@aescentic/database";
import { batBuocQuyen } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TrangNguoiDung() {
  const { ctx } = await batBuocQuyen("user.manage");

  const [dsUser, ganVaiTro, ganCuaHang] = await Promise.all([
    ctx.db.select().from(users).where(isNull(users.archivedAt)).orderBy(asc(users.email)),
    ctx.db
      .select({ userId: userRoles.userId, roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId)),
    ctx.db
      .select({ userId: userStoreAssignments.userId, storeName: stores.name })
      .from(userStoreAssignments)
      .innerJoin(stores, eq(stores.id, userStoreAssignments.storeId)),
  ]);

  const vaiTroTheoUser = new Map<string, string[]>();
  for (const r of ganVaiTro) {
    vaiTroTheoUser.set(r.userId, [...(vaiTroTheoUser.get(r.userId) ?? []), r.roleName]);
  }
  const cuaHangTheoUser = new Map<string, string[]>();
  for (const s of ganCuaHang) {
    cuaHangTheoUser.set(s.userId, [...(cuaHangTheoUser.get(s.userId) ?? []), s.storeName]);
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Người dùng</h1>
      <p className="mt-1 text-sm text-muted">{dsUser.length} tài khoản đang hoạt động.</p>

      <div className="mt-5 overflow-x-auto border border-line">
        <table className="w-full min-w-[680px] bg-surface">
          <thead>
            <tr>
              <th className="th">Họ tên</th>
              <th className="th">Email</th>
              <th className="th">Vai trò</th>
              <th className="th">Cửa hàng được gán</th>
              <th className="th">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {dsUser.map((u) => (
              <tr key={u.id}>
                <td className="td font-medium">{u.fullName ?? "—"}</td>
                <td className="td font-mono text-xs text-muted">{u.email}</td>
                <td className="td">
                  {(vaiTroTheoUser.get(u.id) ?? ["chưa gán"]).map((v) => (
                    <span key={v} className="pill mr-1 bg-line text-ink">{v}</span>
                  ))}
                </td>
                <td className="td text-muted">
                  {(cuaHangTheoUser.get(u.id) ?? []).join(", ") || "toàn công ty / chưa gán"}
                </td>
                <td className="td">
                  <span className={`pill ${u.isActive ? "bg-chip text-ink" : "bg-danger/15 text-danger"}`}>
                    {u.isActive ? "Hoạt động" : "Đã khoá"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
