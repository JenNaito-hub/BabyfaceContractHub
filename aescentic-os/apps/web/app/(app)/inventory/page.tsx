import Link from "next/link";
import { bangTonKho, diaDiemXemDuoc, soKho, NHAN_BIEN_DONG, NHAN_LOAI_KHO } from "@aescentic/inventory";
import { batBuocQuyen } from "@/lib/session";
import { The, Trong, ngayGio, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

export default async function TrangKho() {
  const { ctx, decision } = await batBuocQuyen("inventory.read");

  const [diaDiem, bang, so] = await Promise.all([
    diaDiemXemDuoc(ctx),
    bangTonKho(ctx),
    soKho(ctx, 40),
  ]);

  if (!diaDiem.length) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Kho</h1>
        <p className="mt-2 text-muted">Bạn chưa được gán địa điểm kho nào.</p>
      </div>
    );
  }

  const tongTon = bang.reduce((s, r) => s + r.tong, 0);
  const canhBao = bang.filter((r) => r.tong <= r.reorderPoint).length;
  const xemVon = bang.some((r) => r.unitCost !== null);
  const giaTri = xemVon ? bang.reduce((s, r) => s + (r.unitCost ?? 0) * r.tong, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Kho</h1>
        <p className="mt-1 text-sm text-muted">
          {diaDiem.length} địa điểm · phạm vi <strong>{decision.allowed ? decision.scope : "—"}</strong>
        </p>
      </div>
        <div className="flex gap-2">
          <Link href="/inventory/phieu?kieu=nhap" className="btn-dark">Nhập kho</Link>
          <Link href="/inventory/phieu?kieu=chuyen" className="btn-ghost">Chuyển kho</Link>
        </div>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-3">
        <The nhan="Tổng tồn" giaTri={`${tongTon} sp`} phu={`${bang.length} SKU`} />
        {xemVon && <The nhan="Giá trị tồn kho" giaTri={tienVND(giaTri)} />}
        <The nhan="Dưới ngưỡng" giaTri={canhBao} phu="SKU cần nhập thêm" />
      </div>

      <section>
        <h2 className="mb-3 font-bold">Tồn theo địa điểm</h2>
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[760px] bg-surface" style={{ minWidth: `${220 + (diaDiem.length + 1) * 96}px` }}>
            <thead>
              <tr>
                <th className="th sticky left-0 w-[220px] min-w-[220px] bg-paper">SKU / Sản phẩm</th>
                {diaDiem.map((l) => (
                  <th key={l.id} className="th text-center">
                    {l.name}
                    <div className="font-normal normal-case tracking-normal text-muted">
                      {NHAN_LOAI_KHO[l.kind] ?? l.kind}
                      {l.managedBy === "nhanh" ? " · Nhanh.vn" : ""}
                    </div>
                  </th>
                ))}
                <th className="th text-center">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {bang.slice(0, 80).map((r) => (
                <tr key={r.skuId}>
                  <td className="td sticky left-0 w-[220px] min-w-[220px] bg-surface">
                    <div className="font-medium">{r.productName}</div>
                    <div className="font-mono text-[11px] text-muted">
                      {r.skuCode} · ngưỡng {r.reorderPoint}
                    </div>
                  </td>
                  {diaDiem.map((l) => (
                    <td key={l.id} className="td text-center tabular-nums">
                      <span className={r.theoDiaDiem[l.id] ? "" : "text-muted/40"}>
                        {r.theoDiaDiem[l.id] ?? 0}
                      </span>
                    </td>
                  ))}
                  <td className="td text-center">
                    <span
                      className={`pill ${
                        r.tong <= 0
                          ? "bg-danger/15 text-danger"
                          : r.tong <= r.reorderPoint
                            ? "bg-amber-100 text-amber-900"
                            : "bg-line text-muted"
                      }`}
                    >
                      {r.tong}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Sổ kho gần đây</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted">
          Mọi thay đổi tồn đều để lại một dòng ở đây. Không ai sửa tay được con số tồn —
          kể cả gọi thẳng API.
        </p>
        <div className="overflow-x-auto border border-line">
          {so.length === 0 ? (
            <Trong>Chưa có phát sinh</Trong>
          ) : (
            <table className="w-full min-w-[700px] bg-surface">
              <thead>
                <tr>
                  <th className="th">Thời gian</th>
                  <th className="th">Loại</th>
                  <th className="th">Sản phẩm</th>
                  <th className="th">Địa điểm</th>
                  <th className="th text-right">Thay đổi</th>
                  <th className="th">Chứng từ</th>
                </tr>
              </thead>
              <tbody>
                {so.map((t) => (
                  <tr key={t.id}>
                    <td className="td whitespace-nowrap text-muted">{ngayGio(t.createdAt)}</td>
                    <td className="td">{NHAN_BIEN_DONG[t.kind] ?? t.kind}</td>
                    <td className="td">
                      <span className="font-medium">{t.productName}</span>
                      <span className="ml-2 font-mono text-[11px] text-muted">{t.skuCode}</span>
                    </td>
                    <td className="td text-muted">{t.locationName}</td>
                    <td className={`td text-right font-semibold tabular-nums ${t.delta < 0 ? "text-danger" : ""}`}>
                      {t.delta > 0 ? "+" : ""}{t.delta}
                    </td>
                    <td className="td text-xs text-muted">{t.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
