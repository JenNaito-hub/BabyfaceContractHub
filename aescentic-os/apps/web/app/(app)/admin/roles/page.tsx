import { asc, eq, sql } from "drizzle-orm";
import { permissions, rolePermissions, roles } from "@aescentic/database";
import { batBuocQuyen } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TrangPhanQuyen() {
  const { ctx } = await batBuocQuyen("role.manage");

  const dsVaiTro = await ctx.db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      soQuyen: sql<number>`count(${rolePermissions.permissionId})::int`,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(asc(roles.code));

  const tongQuyen = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(permissions);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Phân quyền</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {dsVaiTro.length} vai trò, {tongQuyen[0]?.n ?? 0} quyền. Vai trò và quyền là{" "}
        <strong>dữ liệu</strong> chứ không phải code — thêm vai trò mới không cần deploy lại.
      </p>

      <div className="mt-5 overflow-x-auto border border-line">
        <table className="w-full min-w-[620px] bg-surface">
          <thead>
            <tr>
              <th className="th">Mã</th>
              <th className="th">Vai trò</th>
              <th className="th">Mô tả</th>
              <th className="th text-right">Số quyền</th>
            </tr>
          </thead>
          <tbody>
            {dsVaiTro.map((r) => (
              <tr key={r.id}>
                <td className="td font-mono text-xs">{r.code}</td>
                <td className="td font-medium">{r.name}</td>
                <td className="td text-muted">{r.description ?? "—"}</td>
                <td className="td text-right tabular-nums font-semibold">{r.soQuyen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
