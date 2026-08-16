import Link from "next/link";
import { eq } from "drizzle-orm";
import { productCosts, products, skus } from "@aescentic/database";
import {
  chuyenKho,
  danhSachChuyen,
  danhSachNhap,
  diaDiemXemDuoc,
  nhanHangChuyen,
  nhapKho,
  NHAN_TRANG_THAI_CHUYEN,
} from "@aescentic/inventory";
import { authorize } from "@aescentic/permissions";
import { batBuocQuyen, docPhien } from "@/lib/session";
import PhieuKhoClient from "@/components/PhieuKhoClient";
import { Trong, ngayGio, tienVND } from "@/components/Bits";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function TrangPhieuKho({
  searchParams,
}: {
  searchParams: Promise<{ kieu?: string }>;
}) {
  const { ctx } = await batBuocQuyen("inventory.read");
  const sp = await searchParams;
  const kieu = sp.kieu === "chuyen" ? "chuyen" : "nhap";

  const duocNhap = authorize(ctx.principal, "inventory.adjust").allowed;
  const duocChuyen = authorize(ctx.principal, "inventory.transfer").allowed;

  const [diaDiem, dsNhap, dsChuyen, dsSku, giaVon] = await Promise.all([
    diaDiemXemDuoc(ctx),
    danhSachNhap(ctx, 25),
    danhSachChuyen(ctx, 25),
    ctx.db
      .select({ id: skus.id, code: skus.code, ten: skus.name, tenSp: products.name })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .where(eq(skus.isActive, true))
      .orderBy(skus.code),
    authorize(ctx.principal, "product.cost").allowed
      ? ctx.db.select().from(productCosts)
      : Promise.resolve([]),
  ]);

  const von = new Map(giaVon.map((c) => [c.skuId, c.unitCost]));

  /** Lưu phiếu. Kiểm quyền lại ở server — không tin gì từ trình duyệt. */
  async function luuPhieu(payload: {
    locationId: string;
    toLocationId?: string;
    supplierName?: string;
    note?: string;
    lines: { skuId: string; quantity: number; unitCost: number }[];
  }): Promise<{ ok: true; code: string } | { ok: false; loi: string }> {
    "use server";
    const ctx2 = await docPhien();
    if (!ctx2) return { ok: false, loi: "Phiên đã hết hạn, đăng nhập lại" };
    try {
      const kq = payload.toLocationId
        ? await chuyenKho(ctx2, {
            fromLocationId: payload.locationId,
            toLocationId: payload.toLocationId,
            note: payload.note,
            lines: payload.lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
          })
        : await nhapKho(ctx2, {
            locationId: payload.locationId,
            supplierName: payload.supplierName,
            note: payload.note,
            lines: payload.lines,
          });
      revalidatePath("/inventory/phieu");
      return { ok: true, code: kq.code };
    } catch (e) {
      return { ok: false, loi: (e as Error).message };
    }
  }

  async function nhanHang(formData: FormData) {
    "use server";
    const ctx2 = await docPhien();
    if (!ctx2) return;
    await nhanHangChuyen(ctx2, String(formData.get("id") ?? ""));
    revalidatePath("/inventory/phieu");
  }

  const duocLap = kieu === "nhap" ? duocNhap : duocChuyen;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/inventory" className="font-mono text-[11px] text-muted underline">
            ← Kho
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            {kieu === "nhap" ? "Nhập kho" : "Chuyển kho"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {kieu === "nhap"
              ? "Nhập hàng về kho. Chốt phiếu là tồn kho cộng và giá vốn cập nhật theo."
              : "Chuyển hàng giữa các kho. Hàng rời kho gửi ngay, vào kho nhận khi bên kia xác nhận."}
          </p>
        </div>
        <div className="flex gap-1 border border-line">
          <Link
            href="/inventory/phieu?kieu=nhap"
            className={`px-3 py-1.5 text-sm font-semibold ${kieu === "nhap" ? "bg-ink text-paper" : "text-muted"}`}
          >
            Nhập kho
          </Link>
          <Link
            href="/inventory/phieu?kieu=chuyen"
            className={`px-3 py-1.5 text-sm font-semibold ${kieu === "chuyen" ? "bg-ink text-paper" : "text-muted"}`}
          >
            Chuyển kho
          </Link>
        </div>
      </div>

      {!diaDiem.length ? (
        <p className="text-muted">Bạn chưa được gán địa điểm kho nào.</p>
      ) : !duocLap ? (
        <p className="border-l-[3px] border-line bg-surface px-4 py-3 text-sm text-muted">
          Bạn xem được nhưng không được lập phiếu {kieu === "nhap" ? "nhập" : "chuyển"}. Cần quyền{" "}
          <code className="font-mono text-ink">
            {kieu === "nhap" ? "inventory.adjust" : "inventory.transfer"}
          </code>
          .
        </p>
      ) : (
        <PhieuKhoClient
          kieu={kieu}
          diaDiem={diaDiem.map((l) => ({
            id: l.id,
            name: `${l.storeName ?? ""} — ${l.name}`.replace(/^ — /, ""),
            kind: l.kind,
            managedBy: l.managedBy,
          }))}
          skus={dsSku.map((s) => ({
            id: s.id,
            code: s.code,
            ten: s.ten ?? s.tenSp,
            giaVon: von.get(s.id) ?? null,
          }))}
          luu={luuPhieu}
        />
      )}

      {kieu === "nhap" ? (
        <section>
          <h2 className="mb-3 font-bold">Phiếu nhập gần đây</h2>
          <div className="overflow-x-auto border border-line">
            {dsNhap.length === 0 ? (
              <Trong>Chưa có phiếu nhập nào</Trong>
            ) : (
              <table className="w-full min-w-[760px] bg-surface">
                <thead>
                  <tr>
                    <th className="th">Mã phiếu</th>
                    <th className="th">Ngày</th>
                    <th className="th">Kho</th>
                    <th className="th">Nhà cung cấp</th>
                    <th className="th text-right">Số lượng</th>
                    <th className="th text-right">Tiền hàng</th>
                    <th className="th">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {dsNhap.map((p) => (
                    <tr key={p.id}>
                      <td className="td font-mono text-xs font-semibold">{p.code}</td>
                      <td className="td whitespace-nowrap text-muted">{ngayGio(p.createdAt)}</td>
                      <td className="td">{p.locationName}</td>
                      <td className="td text-muted">{p.supplierName ?? "—"}</td>
                      <td className="td text-right tabular-nums">{p.soLuong}</td>
                      <td className="td text-right font-semibold tabular-nums">
                        {tienVND(p.tongTien)}
                      </td>
                      <td className="td">
                        <span
                          className={`pill ${p.status === "completed" ? "bg-chip text-ink" : "bg-line text-muted"}`}
                        >
                          {p.status === "completed" ? "Đã nhập" : "Nháp"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : (
        <section>
          <h2 className="mb-3 font-bold">Phiếu chuyển gần đây</h2>
          <div className="overflow-x-auto border border-line">
            {dsChuyen.length === 0 ? (
              <Trong>Chưa có phiếu chuyển nào</Trong>
            ) : (
              <table className="w-full min-w-[820px] bg-surface">
                <thead>
                  <tr>
                    <th className="th">Mã phiếu</th>
                    <th className="th">Ngày</th>
                    <th className="th">Từ kho</th>
                    <th className="th">Đến kho</th>
                    <th className="th text-right">Số lượng</th>
                    <th className="th">Trạng thái</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {dsChuyen.map((p) => (
                    <tr key={p.id}>
                      <td className="td font-mono text-xs font-semibold">{p.code}</td>
                      <td className="td whitespace-nowrap text-muted">{ngayGio(p.createdAt)}</td>
                      <td className="td">{p.tuKhoTen}</td>
                      <td className="td">{p.denKhoTen}</td>
                      <td className="td text-right tabular-nums">{p.soLuong}</td>
                      <td className="td">
                        <span
                          className={`pill ${
                            p.status === "received"
                              ? "bg-chip text-ink"
                              : p.status === "in_transit"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-line text-muted"
                          }`}
                        >
                          {NHAN_TRANG_THAI_CHUYEN[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="td">
                        {p.status === "in_transit" && duocChuyen && (
                          <form action={nhanHang}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn-ghost text-xs">Đã nhận</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
