import Link from "next/link";
import { danhSachDon, NHAN_KENH, NHAN_TRANG_THAI, TRANG_THAI_DON } from "@aescentic/sales";
import { batBuocQuyen } from "@/lib/session";
import { Kenh, ThanhToan, TrangThai, Trong, ngayGio, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

export default async function TrangDonHang({
  searchParams,
}: {
  searchParams: Promise<{ tt?: string; kenh?: string; q?: string }>;
}) {
  const { ctx } = await batBuocQuyen("order.read");
  const sp = await searchParams;

  const ds = await danhSachDon(ctx, {
    trangThai: TRANG_THAI_DON.includes(sp.tt as never) ? (sp.tt as never) : undefined,
    kenh: sp.kenh || undefined,
    tuKhoa: sp.q || undefined,
    gioiHan: 200,
  });

  const tongThu = ds.filter((o) => o.status === "completed").reduce((s, o) => s + Number(o.total), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Đơn hàng</h1>
          <p className="mt-1 text-sm text-muted">
            {ds.length} đơn · doanh thu hoàn thành {tienVND(tongThu)}
          </p>
        </div>
        <form className="flex flex-wrap gap-2">
          <Link href="/orders/nhap" className="btn-ghost">Nhập từ sàn</Link>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Mã đơn, tên khách, SĐT, mã vận đơn…"
            className="input w-auto min-w-[230px]"
          />
          <select name="tt" defaultValue={sp.tt ?? ""} className="input w-auto">
            <option value="">Mọi trạng thái</option>
            {TRANG_THAI_DON.map((t) => (
              <option key={t} value={t}>{NHAN_TRANG_THAI[t]}</option>
            ))}
          </select>
          <select name="kenh" defaultValue={sp.kenh ?? ""} className="input w-auto">
            <option value="">Mọi kênh</option>
            {Object.entries(NHAN_KENH).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="btn-ghost">Lọc</button>
        </form>
      </div>

      <div className="mt-5 overflow-x-auto border border-line">
        {ds.length === 0 ? (
          <Trong>Không có đơn nào khớp bộ lọc</Trong>
        ) : (
          <table className="w-full min-w-[860px] bg-surface">
            <thead>
              <tr>
                <th className="th">Mã đơn</th>
                <th className="th">Ngày</th>
                <th className="th">Kênh</th>
                <th className="th">Khách</th>
                <th className="th">Nơi bán</th>
                <th className="th text-right">Tổng tiền</th>
                <th className="th">Thanh toán</th>
                <th className="th">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((o) => (
                <tr key={o.id} className="hover:bg-ink/[0.02]">
                  <td className="td">
                    <Link href={`/orders/${o.id}`} className="font-mono text-xs font-semibold underline">
                      {o.code}
                    </Link>
                  </td>
                  <td className="td whitespace-nowrap text-muted">{ngayGio(o.placedAt)}</td>
                  <td className="td"><Kenh v={o.channel} /></td>
                  <td className="td">
                    <div className="max-w-[170px] truncate">{o.customerName ?? "—"}</div>
                    <div className="font-mono text-[11px] text-muted">{o.customerPhone ?? ""}</div>
                  </td>
                  <td className="td text-muted">{o.storeName ?? "—"}</td>
                  <td className="td text-right font-semibold tabular-nums">{tienVND(o.total)}</td>
                  <td className="td"><ThanhToan v={o.paymentStatus} /></td>
                  <td className="td"><TrangThai v={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
