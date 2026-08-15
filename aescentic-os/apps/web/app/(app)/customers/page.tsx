import { desc, eq, sql } from "drizzle-orm";
import { customers, orders } from "@aescentic/database";
import { batBuocQuyen } from "@/lib/session";
import { The, Trong, ngayGio, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

const NHAN_NHOM: Record<string, string> = { le: "Khách lẻ", si: "Sỉ / Đại lý", vip: "VIP" };

export default async function TrangKhachHang() {
  const { ctx, decision } = await batBuocQuyen("customer.read");

  // Khách hàng không thuộc về cửa hàng nào trong schema, nên phạm vi phải suy ra
  // từ nơi họ đã mua. Không có bước này thì nhân viên một cửa hàng đọc được
  // toàn bộ danh sách khách của công ty.
  const idCuaHang =
    decision.allowed && decision.filter.kind === "stores" ? decision.filter.storeIds : null;

  // Lọc theo cửa hàng, dùng trong các truy vấn con tính số đơn / chi tiêu.
  // Alias `o` là của chính truy vấn con, nên mảnh này không tự đặt alias mới.
  const locDon = idCuaHang
    ? sql`and o.store_id in (${sql.join(idCuaHang.map((s) => sql`${s}::uuid`), sql`, `)})`
    : sql``;

  // Lọc ở cấp khách: chỉ hiện khách đã từng mua ở cửa hàng mình.
  const locKhach = idCuaHang
    ? sql`exists (select 1 from os.orders oo
                  where oo.customer_id = ${customers.id}
                    and oo.store_id in (${sql.join(idCuaHang.map((s) => sql`${s}::uuid`), sql`, `)}))`
    : sql`true`;

  const ds = idCuaHang && !idCuaHang.length ? [] : await ctx.db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      phone: customers.phone,
      tier: customers.tier,
      province: customers.province,
      soDon: sql<number>`coalesce((
        select count(*)::int from os.orders o
        where o.customer_id = ${customers.id} and o.status = 'completed' ${locDon}
      ), 0)`,
      chiTieu: sql<number>`coalesce((
        select sum(o.total)::bigint from os.orders o
        where o.customer_id = ${customers.id} and o.status = 'completed' ${locDon}
      ), 0)`,
      muaCuoi: sql<Date | null>`(
        select max(o.placed_at) from os.orders o
        where o.customer_id = ${customers.id} ${locDon}
      )`,
    })
    .from(customers)
    .where(locKhach)
    .orderBy(desc(sql`(
      select coalesce(sum(o.total), 0) from os.orders o
      where o.customer_id = ${customers.id} and o.status = 'completed' ${locDon}
    )`))
    .limit(300);

  const muaLai = ds.filter((c) => c.soDon >= 2).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Khách hàng</h1>
        <p className="mt-1 text-sm text-muted">
          Khách được tạo tự động theo số điện thoại mỗi khi chốt đơn.
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-3">
        <The nhan="Tổng khách" giaTri={ds.length} />
        <The nhan="Khách mua lại" giaTri={muaLai} phu="Từ 2 đơn trở lên" />
        <The nhan="Sỉ / VIP" giaTri={ds.filter((c) => c.tier !== "le").length} />
      </div>

      <div className="overflow-x-auto border border-line">
        {ds.length === 0 ? (
          <Trong>Chưa có khách hàng nào</Trong>
        ) : (
          <table className="w-full min-w-[720px] bg-surface">
            <thead>
              <tr>
                <th className="th">Khách</th>
                <th className="th">Nhóm</th>
                <th className="th">Khu vực</th>
                <th className="th text-right">Số đơn</th>
                <th className="th text-right">Tổng chi tiêu</th>
                <th className="th">Mua gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((c) => (
                <tr key={c.id}>
                  <td className="td">
                    <div className="font-medium">{c.fullName}</div>
                    <div className="font-mono text-[11px] text-muted">{c.phone ?? "—"}</div>
                  </td>
                  <td className="td">
                    <span className={`pill ${c.tier === "vip" ? "bg-chip text-ink" : c.tier === "si" ? "bg-blue-100 text-blue-900" : "bg-line text-muted"}`}>
                      {NHAN_NHOM[c.tier] ?? c.tier}
                    </span>
                  </td>
                  <td className="td text-muted">{c.province ?? "—"}</td>
                  <td className="td text-right tabular-nums">{c.soDon}</td>
                  <td className="td text-right font-semibold tabular-nums">{tienVND(c.chiTieu)}</td>
                  <td className="td text-muted">{c.muaCuoi ? ngayGio(c.muaCuoi) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
