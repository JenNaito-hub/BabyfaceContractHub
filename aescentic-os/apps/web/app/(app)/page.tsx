import Link from "next/link";
import { authorize } from "@aescentic/permissions";
import { doanhThuTheoKenh, danhSachDon, thongKe, NHAN_KENH } from "@aescentic/sales";
import { sapHetHang } from "@aescentic/inventory";
import { taoPosProvider } from "@aescentic/integrations";
import { docPhien } from "@/lib/session";
import { CotNgay, ThanhNgang, The, Trong, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

const MAU_KENH: Record<string, string> = {
  shopee: "#E8553A", tiktok: "#141810", facebook: "#3B6BD6",
  website: "#8FA004", store: "#B9CF06",
};

export default async function TongQuan({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>;
}) {
  const ctx = (await docPhien())!;
  const sp = await searchParams;

  const now = new Date();
  const thang = /^\d{4}-\d{2}$/.test(sp.thang ?? "")
    ? sp.thang!
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = thang.split("-").map(Number);
  const tu = new Date(y!, m! - 1, 1);
  const den = new Date(y!, m!, 1);

  const [tk, theoKenh, canhBao, ds] = await Promise.all([
    thongKe(ctx, tu, den),
    doanhThuTheoKenh(ctx, tu, den),
    sapHetHang(ctx, 8),
    danhSachDon(ctx, { tuNgay: tu, denNgay: den, gioiHan: 5000 }),
  ]);

  // Doanh thu từng ngày trong tháng
  const theoNgay = new Map<string, number>();
  for (const o of ds) {
    if (o.status !== "completed") continue;
    const d = new Date(o.placedAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    theoNgay.set(k, (theoNgay.get(k) ?? 0) + Number(o.total));
  }
  const cot: { nhan: string; giaTri: number }[] = [];
  for (const d = new Date(tu); d < den; d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cot.push({ nhan: k, giaTri: theoNgay.get(k) ?? 0 });
  }

  const pos = taoPosProvider();
  const banDuoc = authorize(ctx.principal, "order.create").allowed;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Tháng {thang.split("-")[1]}/{thang.split("-")[0]}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            Chào {ctx.fullName ?? ctx.email}
          </h1>
        </div>
        {/* `flex-wrap` + `min-w-0`: thêm một nút nữa là hàng này tràn ngang
            trên điện thoại, và cả trang cuộn ngang theo. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <form className="flex min-w-0 items-center gap-2">
            <input
              type="month"
              name="thang"
              defaultValue={thang}
              className="input w-auto min-w-0 max-w-[160px]"
            />
            <button className="btn-ghost">Xem</button>
          </form>
          <a href={`/api/bao-cao?thang=${thang}`} className="btn-ghost">Tải Excel</a>
          {banDuoc && <Link href="/pos" className="btn-dark">Bán hàng</Link>}
        </div>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        <The nhan="Doanh thu" giaTri={tienVND(tk.doanhThu)} phu={`${tk.soDon} đơn hoàn thành`} noiBat />
        {tk.xemDuocLoiNhuan ? (
          <The
            nhan="Lợi nhuận gộp"
            giaTri={tienVND(tk.loiNhuan)}
            phu={tk.tienHang ? `Biên ${Math.round((tk.loiNhuan / tk.tienHang) * 100)}%` : "—"}
          />
        ) : (
          <The nhan="Sản phẩm bán ra" giaTri={tk.soSanPham} />
        )}
        <The nhan="Giá trị đơn TB" giaTri={tienVND(tk.giaTriTB)} phu={`${tk.soSanPham} sản phẩm`} />
        <The nhan="Cần xử lý" giaTri={tk.donCanXuLy} phu={`COD đang giao ${tienVND(tk.codDangGiao)}`} />
      </div>

      <section className="card">
        <h2 className="mb-4 font-bold">Doanh thu theo ngày</h2>
        <CotNgay data={cot} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-bold">Theo kênh bán</h2>
          <ThanhNgang
            data={theoKenh.map((k) => ({
              nhan: NHAN_KENH[k.kenh] ?? k.kenh,
              giaTri: k.doanhThu,
              mau: MAU_KENH[k.kenh],
            }))}
          />
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Sắp hết hàng</h2>
            <Link href="/inventory" className="font-mono text-[11px] text-muted underline">
              Xem kho
            </Link>
          </div>
          {canhBao.length === 0 ? (
            <Trong>Tồn kho đang ổn</Trong>
          ) : (
            <ul className="divide-y divide-line">
              {canhBao.map((r) => (
                <li key={r.skuId} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.productName}</div>
                    <div className="font-mono text-[11px] text-muted">{r.skuCode}</div>
                  </div>
                  <span className={`pill ${r.tong <= 0 ? "bg-danger/15 text-danger" : "bg-amber-100 text-amber-900"}`}>
                    còn {r.tong} / ngưỡng {r.reorderPoint}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pos.laMock && (
        <div className="border-l-[3px] border-danger bg-surface px-4 py-3 text-sm">
          <strong>Đang chạy POS giả lập.</strong> {pos.lyDo} — số liệu bên trên là dữ liệu mẫu
          trong hệ thống, chưa đồng bộ từ Nhanh.vn.
        </div>
      )}
    </div>
  );
}
