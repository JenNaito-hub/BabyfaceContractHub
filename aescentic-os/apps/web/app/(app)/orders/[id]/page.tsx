import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { chiTietDon, doiTrangThai, NHAN_TRANG_THAI, TRANG_THAI_DON, type TrangThaiDon } from "@aescentic/sales";
import { batBuocQuyen, docPhien } from "@/lib/session";
import { Kenh, ThanhToan, TrangThai, ngayGio, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

export default async function ChiTietDon({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await batBuocQuyen("order.read");

  const kq = await chiTietDon(ctx, id);
  if (!kq) notFound();
  const { don, dong, giaVon, xemGiaVon } = kq;

  const vonTheoDong = new Map(giaVon.map((c) => [c.orderLineId, c.unitCost]));
  const tongVon = dong.reduce((s, d) => s + (vonTheoDong.get(d.id) ?? 0) * d.quantity, 0);

  async function doiTT(formData: FormData) {
    "use server";
    const ctx2 = await docPhien();
    if (!ctx2) redirect("/login");
    const tt = String(formData.get("status") ?? "") as TrangThaiDon;
    if (!TRANG_THAI_DON.includes(tt)) return;
    await doiTrangThai(ctx2, id, tt);
    redirect(`/orders/${id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/orders" className="font-mono text-[11px] text-muted underline">← Đơn hàng</Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            {don.code}
            <Kenh v={don.channel} />
          </h1>
          <p className="text-sm text-muted">{ngayGio(don.placedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TrangThai v={don.status} />
          <ThanhToan v={don.paymentStatus} />
          <form action={doiTT} className="flex gap-2">
            <select name="status" defaultValue={don.status} className="input w-auto">
              {TRANG_THAI_DON.map((t) => (
                <option key={t} value={t}>{NHAN_TRANG_THAI[t]}</option>
              ))}
            </select>
            <button className="btn-dark">Đổi</button>
          </form>
        </div>
      </div>

      {don.stockApplied && (
        <div className="border-l-[3px] border-amber-500 bg-surface px-4 py-3 text-sm">
          Đơn đã trừ kho. Đưa về trạng thái “Mới” thì hàng tự quay lại kho.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="border border-line bg-surface">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Sản phẩm</th>
                <th className="th text-center">SL</th>
                <th className="th text-right">Đơn giá</th>
                <th className="th text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {dong.map((d) => (
                <tr key={d.id}>
                  <td className="td">
                    <div className="font-medium">{d.displayName ?? d.skuCode}</div>
                    <div className="font-mono text-[11px] text-muted">{d.skuCode}</div>
                  </td>
                  <td className="td text-center tabular-nums">{d.quantity}</td>
                  <td className="td text-right tabular-nums">{tienVND(d.unitPrice)}</td>
                  <td className="td text-right font-semibold tabular-nums">
                    {tienVND(d.quantity * d.unitPrice - d.discount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 font-bold">Thanh toán</h2>
            <dl className="space-y-1.5 text-sm">
              <Dong nhan="Tiền hàng" gt={tienVND(don.subtotal)} />
              <Dong nhan="Giảm giá" gt={`−${tienVND(don.discount)}`} />
              <Dong nhan="Phí ship" gt={`+${tienVND(don.shippingFee)}`} />
              <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold">
                <dt>Tổng</dt>
                <dd className="tabular-nums">{tienVND(don.total)}</dd>
              </div>
            </dl>
            {xemGiaVon && (
              <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                <Dong nhan="Giá vốn" gt={tienVND(tongVon)} />
                <div className="flex justify-between font-semibold">
                  <dt>Lãi gộp</dt>
                  <dd className="tabular-nums">{tienVND(don.subtotal - tongVon)}</dd>
                </div>
              </dl>
            )}
          </section>

          <section className="card text-sm">
            <h2 className="mb-2 font-bold">Khách hàng</h2>
            <p className="font-medium">{don.customerName ?? "—"}</p>
            <p className="font-mono text-muted">{don.customerPhone ?? "—"}</p>
            <p className="mt-1 text-muted">
              {[don.address, don.district, don.province].filter(Boolean).join(", ") || "—"}
            </p>
            {don.trackingCode && (
              <p className="mt-2 border-t border-line pt-2">
                {don.carrier} · <span className="font-mono font-semibold">{don.trackingCode}</span>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Dong({ nhan, gt }: { nhan: string; gt: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{nhan}</dt>
      <dd className="tabular-nums">{gt}</dd>
    </div>
  );
}
