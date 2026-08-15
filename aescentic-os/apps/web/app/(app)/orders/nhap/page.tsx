import { eq } from "drizzle-orm";
import { products, skus } from "@aescentic/database";
import { diaDiemBanDuoc, nhapDonTuSan, type DonTuSan } from "@aescentic/sales";
import { batBuocQuyen, docPhien } from "@/lib/session";
import NhapDonClient from "@/components/NhapDonClient";

export const dynamic = "force-dynamic";

export default async function TrangNhapDon() {
  const { ctx } = await batBuocQuyen("order.create");

  const diaDiem = await diaDiemBanDuoc(ctx);
  if (!diaDiem.length) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Nhập đơn từ sàn</h1>
        <p className="mt-2 text-muted">
          Bạn chưa được gán cửa hàng nào, nên chưa có kho để trừ hàng khi nhập đơn.
        </p>
      </div>
    );
  }

  const dsSku = await ctx.db
    .select({ id: skus.id, code: skus.code, ten: products.name })
    .from(skus)
    .innerJoin(products, eq(products.id, skus.productId))
    .where(eq(skus.isActive, true))
    .orderBy(skus.code);

  /** Nhập thật. Kiểm quyền lại ở server — không tin gì từ trình duyệt. */
  async function nhapDon(payload: {
    kenh: string;
    storeId: string;
    locationId: string;
    dons: DonTuSan[];
  }): Promise<
    | { ok: true; daNhap: number; boQua: number; loi: { maDonSan: string; lyDo: string }[] }
    | { ok: false; loi: string }
  > {
    "use server";
    const ctx2 = await docPhien();
    if (!ctx2) return { ok: false, loi: "Phiên đã hết hạn, đăng nhập lại" };

    try {
      const kq = await nhapDonTuSan(ctx2, payload);
      return { ok: true, ...kq };
    } catch (e) {
      return { ok: false, loi: (e as Error).message };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Nhập đơn từ sàn</h1>
        <p className="mt-1 text-sm text-muted">
          Tải file Shopee / TikTok Shop xuất ra. Tải lại cùng một file không làm nhân đôi đơn —
          đơn đã nhập sẽ được bỏ qua.
        </p>
      </div>

      <NhapDonClient
        diaDiem={diaDiem.map((l) => ({
          id: l.id,
          name: l.name,
          storeId: l.storeId!,
          storeName: l.storeName ?? "—",
        }))}
        skus={dsSku}
        nhapDon={nhapDon}
      />
    </div>
  );
}
