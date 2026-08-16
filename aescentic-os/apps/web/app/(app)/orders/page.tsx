import Link from "next/link";
import { danhSachDon, NHAN_KENH, NHAN_TRANG_THAI, TRANG_THAI_DON } from "@aescentic/sales";
import { batBuocQuyen } from "@/lib/session";
import { tienVND } from "@/components/Bits";
import BangDonClient from "@/components/BangDonClient";

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

      <div className="mt-5">
        <BangDonClient
          ds={ds.map((o) => ({
            id: o.id,
            code: o.code,
            channel: o.channel,
            storeName: o.storeName,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            status: o.status,
            paymentStatus: o.paymentStatus,
            total: Number(o.total),
            placedAt: o.placedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
