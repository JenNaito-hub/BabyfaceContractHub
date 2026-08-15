import { asc, eq, sql } from "drizzle-orm";
import { inventoryBalances, productCosts, products, skus } from "@aescentic/database";
import { authorize } from "@aescentic/permissions";
import { batBuocQuyen } from "@/lib/session";
import { Trong, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

export default async function TrangSanPham() {
  const { ctx } = await batBuocQuyen("product.read");
  const xemVon = authorize(ctx.principal, "product.cost").allowed;

  const [ds, von] = await Promise.all([
    ctx.db
      .select({
        id: skus.id,
        code: skus.code,
        name: skus.name,
        volumeMl: skus.volumeMl,
        retailPrice: skus.retailPrice,
        wholesalePrice: skus.wholesalePrice,
        reorderPoint: skus.reorderPoint,
        isActive: skus.isActive,
        productName: products.name,
        lifecycle: products.lifecycle,
        tong: sql<number>`coalesce((
          select sum(b.quantity)::int from os.inventory_balances b where b.sku_id = ${skus.id}
        ), 0)`,
      })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .orderBy(asc(skus.code)),
    xemVon ? ctx.db.select().from(productCosts) : Promise.resolve([]),
  ]);

  const vonTheoSku = new Map(von.map((c) => [c.skuId, c.unitCost]));

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Sản phẩm</h1>
      <p className="mt-1 text-sm text-muted">{ds.length} SKU trong danh mục</p>

      <div className="mt-5 overflow-x-auto border border-line">
        {ds.length === 0 ? (
          <Trong>Chưa có sản phẩm nào</Trong>
        ) : (
          <table className="w-full min-w-[820px] bg-surface">
            <thead>
              <tr>
                <th className="th">SKU</th>
                <th className="th">Sản phẩm</th>
                <th className="th">Dung tích</th>
                <th className="th text-right">Giá lẻ</th>
                <th className="th text-right">Giá sỉ</th>
                {xemVon && <th className="th text-right">Giá vốn</th>}
                <th className="th text-right">Tồn</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((s) => {
                const v = vonTheoSku.get(s.id) ?? 0;
                const bien = xemVon && s.retailPrice > 0 && v > 0
                  ? Math.round(((s.retailPrice - v) / s.retailPrice) * 100)
                  : null;
                return (
                  <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                    <td className="td font-mono text-xs">{s.code}</td>
                    <td className="td">
                      <div className="font-medium">{s.productName}</div>
                      <div className="font-mono text-[11px] text-muted">{s.lifecycle}</div>
                    </td>
                    <td className="td text-muted">{s.volumeMl ? `${s.volumeMl}ml` : "—"}</td>
                    <td className="td text-right tabular-nums">{tienVND(s.retailPrice)}</td>
                    <td className="td text-right tabular-nums text-muted">{tienVND(s.wholesalePrice)}</td>
                    {xemVon && (
                      <td className="td text-right tabular-nums">
                        {tienVND(v)}
                        {bien !== null && <div className="text-xs text-muted">biên {bien}%</div>}
                      </td>
                    )}
                    <td className="td text-right">
                      <span className={`pill ${
                        s.tong <= 0 ? "bg-danger/15 text-danger"
                        : s.tong <= s.reorderPoint ? "bg-amber-100 text-amber-900"
                        : "bg-line text-muted"}`}>
                        {s.tong}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
