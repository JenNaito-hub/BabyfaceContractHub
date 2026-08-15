import { eq } from "drizzle-orm";
import { orders, products, skus } from "@aescentic/database";
import { diaDiemBanDuoc, taoDon } from "@aescentic/sales";
import { tonTheoDiaDiem } from "@aescentic/inventory";
import { batBuocQuyen, docPhien } from "@/lib/session";
import PosClient from "@/components/PosClient";

export const dynamic = "force-dynamic";

export type SkuBan = {
  id: string;
  code: string;
  name: string | null;
  productName: string;
  barcode: string | null;
  retailPrice: number;
  wholesalePrice: number;
};

export default async function TrangPos({
  searchParams,
}: {
  searchParams: Promise<{ kho?: string }>;
}) {
  const { ctx } = await batBuocQuyen("order.create");
  const sp = await searchParams;

  const diaDiem = await diaDiemBanDuoc(ctx);
  if (!diaDiem.length) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Bán hàng</h1>
        <p className="mt-2 text-muted">
          Bạn chưa được gán cửa hàng nào để bán. Nhờ quản trị viên gán trong Cài đặt.
        </p>
      </div>
    );
  }

  const chon = diaDiem.find((l) => l.id === sp.kho) ?? diaDiem[0]!;

  const [dsSku, ton] = await Promise.all([
    ctx.db
      .select({
        id: skus.id,
        code: skus.code,
        name: skus.name,
        productName: products.name,
        barcode: skus.barcode,
        retailPrice: skus.retailPrice,
        wholesalePrice: skus.wholesalePrice,
      })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .where(eq(skus.isActive, true))
      .orderBy(skus.code),
    tonTheoDiaDiem(ctx, chon.id),
  ]);

  /** Chốt đơn. Kiểm quyền lại ở server — không tin gì từ client. */
  async function banHang(payload: {
    locationId: string;
    storeId: string;
    customerName: string;
    customerPhone: string;
    discount: number;
    paymentStatus: string;
    note: string;
    lines: { skuId: string; quantity: number; unitPrice: number }[];
  }): Promise<{ ok: true; id: string; code: string } | { ok: false; loi: string }> {
    "use server";
    const ctx2 = await docPhien();
    if (!ctx2) return { ok: false, loi: "Phiên đã hết hạn, đăng nhập lại" };

    try {
      const id = await taoDon(ctx2, {
        channel: "store",
        storeId: payload.storeId,
        locationId: payload.locationId,
        customerName: payload.customerName || undefined,
        customerPhone: payload.customerPhone || undefined,
        paymentStatus: payload.paymentStatus,
        discount: payload.discount,
        note: payload.note || undefined,
        lines: payload.lines,
        chotSang: "completed",
      });
      const [don] = await ctx2.db
        .select({ code: orders.code })
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      return { ok: true, id, code: don?.code ?? "—" };
    } catch (e) {
      return { ok: false, loi: (e as Error).message };
    }
  }

  return (
    <PosClient
      diaDiem={diaDiem.map((l) => ({
        id: l.id,
        name: l.name,
        storeId: l.storeId!,
        storeName: l.storeName ?? l.name,
      }))}
      diaDiemChon={chon.id}
      skus={dsSku}
      ton={Object.fromEntries(ton)}
      banHang={banHang}
    />
  );
}
