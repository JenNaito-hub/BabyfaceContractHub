import { redirect } from "next/navigation";
import { donDeIn, NHAN_KENH, NHAN_THANH_TOAN, type DonDeIn } from "@aescentic/sales";
import { batBuocQuyen } from "@/lib/session";
import { tienVND } from "@/components/Bits";
import InClient from "@/components/InClient";

export const dynamic = "force-dynamic";

/**
 * Trang in — nằm NGOÀI layout của app để không dính thanh menu vào giấy.
 *
 * `?ids=a,b,c&kieu=phieu|hoadon`
 */
export default async function TrangIn({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; kieu?: string }>;
}) {
  const { ctx } = await batBuocQuyen("order.read");
  const sp = await searchParams;

  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const kieu = sp.kieu === "hoadon" ? "hoadon" : "phieu";
  if (!ids.length) redirect("/orders");

  const ds = await donDeIn(ctx, ids);

  if (!ds.length) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="font-semibold">Không in được đơn nào.</p>
        <p className="mt-2 text-sm text-muted">
          Đơn không tồn tại, hoặc không thuộc phạm vi bạn được xem.
        </p>
      </div>
    );
  }

  return (
    <div>
      <InClient soLuong={ds.length} kieu={kieu} />
      {ds.map((x) =>
        kieu === "hoadon" ? <HoaDon key={x.don.id} x={x} /> : <PhieuGiao key={x.don.id} x={x} />,
      )}
    </div>
  );
}

function ngayVN(d: Date | string) {
  const x = new Date(d);
  return (
    x.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    x.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Phiếu giao hàng khổ A5 — dán lên kiện hàng. */
function PhieuGiao({ x }: { x: DonDeIn }) {
  const { don, dong, cuaHang } = x;
  // Ô shipper nhìn vào. Chỉ hiện số tiền khi THẬT SỰ phải thu — in nhầm số ở
  // đây là shipper thu tiền của khách đã trả rồi.
  const thuHo = don.paymentStatus === "cod" ? Number(don.total) : 0;

  return (
    <section className="print-page mx-auto my-4 w-[148mm] border border-line p-5 text-[11px] leading-snug">
      <header className="flex items-start justify-between border-b-2 border-ink pb-2">
        <div>
          <div className="text-lg font-extrabold tracking-tight">AESCENTIC</div>
          <div className="text-muted">{cuaHang?.name ?? "—"}</div>
          {cuaHang?.address && <div className="text-muted">{cuaHang.address}</div>}
          {cuaHang?.phone && <div className="text-muted">ĐT: {cuaHang.phone}</div>}
        </div>
        <div className="text-right">
          <div className="font-mono text-base font-extrabold">{don.code}</div>
          <div className="text-muted">{ngayVN(don.placedAt)}</div>
          <div className="text-muted">{NHAN_KENH[don.channel] ?? don.channel}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 border-b border-line py-3">
        <div>
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted">
            Người nhận
          </div>
          <div className="text-sm font-bold">{don.customerName || "—"}</div>
          <div className="font-mono">{don.customerPhone || "—"}</div>
          <div className="mt-1">
            {[don.address, don.district, don.province].filter(Boolean).join(", ") || "—"}
          </div>
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted">
            Vận chuyển
          </div>
          <div>{don.carrier || "—"}</div>
          {don.trackingCode && (
            <div className="mt-1 font-mono text-base font-extrabold tracking-wider">
              {don.trackingCode}
            </div>
          )}
          {don.externalRef && <div className="text-muted">Mã sàn: {don.externalRef}</div>}
        </div>
      </div>

      <table className="w-full border-collapse py-2">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-1 font-mono text-[10px] font-bold uppercase text-muted">Sản phẩm</th>
            <th className="py-1 text-center font-mono text-[10px] font-bold uppercase text-muted">SL</th>
            <th className="py-1 text-right font-mono text-[10px] font-bold uppercase text-muted">Đơn giá</th>
            <th className="py-1 text-right font-mono text-[10px] font-bold uppercase text-muted">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((it) => (
            <tr key={it.id} className="border-b border-line/60">
              <td className="py-1">
                {it.displayName ?? it.skuCode}
                {/* Chỉ in mã khi nó khác tên — dữ liệu cũ có dòng lưu tên bằng
                    chính mã SKU, in cả hai thành "AES-007-50 AES-007-50". */}
                {it.skuCode && it.skuCode !== it.displayName && (
                  <span className="ml-1 font-mono text-[10px] text-muted">{it.skuCode}</span>
                )}
              </td>
              <td className="py-1 text-center font-bold">{it.quantity}</td>
              <td className="py-1 text-right">{tienVND(it.unitPrice)}</td>
              <td className="py-1 text-right">
                {tienVND(it.quantity * Number(it.unitPrice) - Number(it.discount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-2 w-1/2 space-y-0.5">
        <Dong nhan="Tiền hàng" giaTri={tienVND(don.subtotal)} />
        {Number(don.discount) > 0 && <Dong nhan="Giảm giá" giaTri={`−${tienVND(don.discount)}`} />}
        {Number(don.shippingFee) > 0 && (
          <Dong nhan="Phí ship" giaTri={`+${tienVND(don.shippingFee)}`} />
        )}
        <div className="flex justify-between border-t border-ink pt-1 text-sm font-extrabold">
          <span>Tổng cộng</span>
          <span>{tienVND(don.total)}</span>
        </div>
        <div className="flex justify-between bg-ink px-2 py-1 text-sm font-extrabold text-paper">
          {thuHo > 0 ? (
            <>
              <span>THU HỘ (COD)</span>
              <span>{tienVND(thuHo)}</span>
            </>
          ) : (
            <>
              <span>{NHAN_THANH_TOAN[don.paymentStatus] ?? don.paymentStatus}</span>
              <span>KHÔNG THU TIỀN</span>
            </>
          )}
        </div>
      </div>

      {don.note && (
        <p className="mt-2 border-t border-line pt-2">
          <span className="font-bold">Ghi chú:</span> {don.note}
        </p>
      )}

      <footer className="mt-3 flex justify-between border-t border-line pt-2 text-[10px] text-muted">
        <span>Kiểm tra hàng trước khi thanh toán. Đổi trả trong 7 ngày nếu còn nguyên seal.</span>
        <span>aescentic.vn</span>
      </footer>
    </section>
  );
}

/** Hoá đơn bán lẻ khổ 80mm — máy in nhiệt tại quầy. */
function HoaDon({ x }: { x: DonDeIn }) {
  const { don, dong, cuaHang } = x;

  return (
    <section className="print-page mx-auto my-4 w-[76mm] p-2 font-mono text-[10px] leading-tight">
      <div className="text-center">
        <div className="text-base font-extrabold">AESCENTIC</div>
        <div>{cuaHang?.name ?? "—"}</div>
        {cuaHang?.address && <div>{cuaHang.address}</div>}
        {cuaHang?.phone && <div>ĐT: {cuaHang.phone}</div>}
      </div>

      <div className="my-2 border-y border-dashed border-ink/40 py-1">
        <Dong nhan="Đơn" giaTri={don.code} />
        <Dong nhan="Ngày" giaTri={ngayVN(don.placedAt)} />
        {don.customerPhone && (
          <Dong nhan="Khách" giaTri={don.customerName || don.customerPhone} />
        )}
      </div>

      {dong.map((it) => (
        <div key={it.id} className="mb-1">
          <div>{it.displayName ?? it.skuCode}</div>
          <div className="flex justify-between">
            <span>
              {it.quantity} × {tienVND(it.unitPrice)}
            </span>
            <span>{tienVND(it.quantity * Number(it.unitPrice) - Number(it.discount))}</span>
          </div>
        </div>
      ))}

      <div className="mt-2 border-t border-dashed border-ink/40 pt-1">
        <Dong nhan="Tiền hàng" giaTri={tienVND(don.subtotal)} />
        {Number(don.discount) > 0 && <Dong nhan="Giảm giá" giaTri={`−${tienVND(don.discount)}`} />}
        {Number(don.shippingFee) > 0 && (
          <Dong nhan="Phí ship" giaTri={`+${tienVND(don.shippingFee)}`} />
        )}
        <div className="flex justify-between text-xs font-extrabold">
          <span>TỔNG</span>
          <span>{tienVND(don.total)}</span>
        </div>
        <Dong nhan="Thanh toán" giaTri={NHAN_THANH_TOAN[don.paymentStatus] ?? don.paymentStatus} />
      </div>

      <p className="mt-3 text-center">Cảm ơn bạn đã chọn Aescentic!</p>
      <p className="text-center">aescentic.vn</p>
    </section>
  );
}

function Dong({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{nhan}</span>
      <span>{giaTri}</span>
    </div>
  );
}
