import { sql } from "drizzle-orm";
import { authorize } from "@aescentic/permissions";
import { taoPosProvider } from "@aescentic/integrations";
import { docPhien } from "@/lib/session";

export const dynamic = "force-dynamic";

const KIEM_TRA = [
  ["store.read", "Xem cửa hàng"],
  ["inventory.adjust", "Điều chỉnh tồn kho"],
  ["product.cost", "Xem giá vốn"],
  ["payroll.read", "Xem lương"],
  ["payroll.approve", "Duyệt lương"],
  ["config.manage", "Sửa cấu hình hệ thống"],
  ["role.manage", "Phân quyền"],
] as const;

export default async function TongQuan() {
  const ctx = (await docPhien())!;
  const pos = taoPosProvider();

  const [dongCuaHang] = await ctx.db.execute<{ n: string }>(
    sql`select count(*)::text as n from os.stores`,
  );
  const [dongSku] = await ctx.db.execute<{ n: string }>(
    sql`select count(*)::text as n from os.skus`,
  );
  const soCuaHang = dongCuaHang?.n ?? "0";
  const soSku = dongSku?.n ?? "0";

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Phase 0 · nền móng
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Chào {ctx.fullName ?? ctx.email}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Hệ thống đang chạy với đúng quyền của bạn. Bảng dưới cho thấy phân quyền được
          áp ra sao — đây là kết quả thật từ database, không phải danh sách viết cứng.
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-3">
        {[
          ["Cửa hàng & kho", soCuaHang],
          ["SKU trong danh mục", soSku],
          ["Quyền của bạn", String(ctx.principal.permissions.length)],
        ].map(([nhan, gt]) => (
          <div key={nhan} className="bg-surface px-5 py-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
              {nhan}
            </div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{gt}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-bold">Bạn được làm gì</h2>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full min-w-[520px] bg-surface">
            <thead>
              <tr>
                <th className="th">Hành động</th>
                <th className="th">Kết quả</th>
                <th className="th">Phạm vi dữ liệu</th>
              </tr>
            </thead>
            <tbody>
              {KIEM_TRA.map(([quyen, nhan]) => {
                const d = authorize(ctx.principal, quyen);
                return (
                  <tr key={quyen}>
                    <td className="td">
                      {nhan}
                      <span className="ml-2 font-mono text-[11px] text-muted">{quyen}</span>
                    </td>
                    <td className="td">
                      {d.allowed ? (
                        <span className="pill bg-chip text-ink">Được</span>
                      ) : (
                        <span className="pill bg-danger/15 text-danger">Không</span>
                      )}
                    </td>
                    <td className="td font-mono text-xs text-muted">
                      {d.allowed ? moTaPhamVi(d.filter) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Tình trạng tích hợp</h2>
        <div className="card mt-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="pill bg-line text-ink">POS · {pos.provider.name}</span>
            {pos.laMock ? (
              <span className="pill bg-danger/15 text-danger">Đang chạy giả lập</span>
            ) : (
              <span className="pill bg-chip text-ink">Đã nối thật</span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">{pos.lyDo}</p>
        </div>
      </section>
    </div>
  );
}

function moTaPhamVi(f: { kind: string; storeIds?: string[]; departmentIds?: string[] }): string {
  if (f.kind === "all") return "toàn công ty";
  if (f.kind === "self") return "chỉ bản thân";
  if (f.kind === "stores") return `${f.storeIds?.length ?? 0} cửa hàng được gán`;
  if (f.kind === "departments") return `${f.departmentIds?.length ?? 0} phòng ban`;
  return f.kind;
}
