import {
  chotDoiSoatCod,
  donCodChuaDoiSoat,
  hangVanChuyenCoCod,
  lichSuDoiSoat,
  type DongChotDoiSoat,
} from "@aescentic/sales";
import { batBuocQuyen, docPhien } from "@/lib/session";
import { authorize } from "@aescentic/permissions";
import DoiSoatClient from "@/components/DoiSoatClient";
import { The, Trong, ngayGio, tienVND } from "@/components/Bits";

export const dynamic = "force-dynamic";

export default async function TrangDoiSoat() {
  const { ctx } = await batBuocQuyen("cod.read");

  const [hang, dons, lichSu] = await Promise.all([
    hangVanChuyenCoCod(ctx),
    donCodChuaDoiSoat(ctx),
    lichSuDoiSoat(ctx, 20),
  ]);

  const duocChot = authorize(ctx.principal, "cod.reconcile").allowed;
  const tongCho = hang.reduce((s, h) => s + h.tongTien, 0);

  /** Chốt đối soát. Kiểm quyền lại ở server — không tin gì từ trình duyệt. */
  async function chotDoiSoat(payload: {
    carrier: string;
    fileName?: string;
    chot: DongChotDoiSoat[];
    tatCa: DongChotDoiSoat[];
  }): Promise<{ ok: true; daChot: number; tongTien: number } | { ok: false; loi: string }> {
    "use server";
    const ctx2 = await docPhien();
    if (!ctx2) return { ok: false, loi: "Phiên đã hết hạn, đăng nhập lại" };
    try {
      const kq = await chotDoiSoatCod(ctx2, payload);
      return { ok: true, daChot: kq.daChot, tongTien: kq.tongTien };
    } catch (e) {
      return { ok: false, loi: (e as Error).message };
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Đối soát COD</h1>
        <p className="mt-1 text-sm text-muted">
          So tiền hãng vận chuyển chuyển về với đơn trong hệ thống. Đơn khớp sẽ chuyển sang
          <em> đã thanh toán</em>; đơn lệch phải xem rồi mới quyết định.
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <The nhan="Tiền COD đang chờ về" giaTri={tienVND(tongCho)} phu={`${dons.length} đơn`} noiBat />
        <The nhan="Số hãng đang giữ tiền" giaTri={hang.length} />
      </div>

      {duocChot ? (
        <DoiSoatClient
          hang={hang}
          dons={dons.map((d) => ({
            id: d.id,
            code: d.code,
            total: Number(d.total),
            trackingCode: d.trackingCode,
            customerName: d.customerName,
            carrier: d.carrier,
            placedAt: d.placedAt.toISOString(),
            daDoiSoat: false,
          }))}
          chotDoiSoat={chotDoiSoat}
        />
      ) : (
        <p className="border-l-[3px] border-line bg-surface px-4 py-3 text-sm text-muted">
          Bạn xem được tình trạng đối soát nhưng không được chốt. Cần quyền{" "}
          <code className="font-mono text-ink">cod.reconcile</code>.
        </p>
      )}

      <section>
        <h2 className="mb-3 font-bold">Các đợt đã đối soát</h2>
        <div className="overflow-x-auto border border-line">
          {lichSu.length === 0 ? (
            <Trong>Chưa có đợt đối soát nào</Trong>
          ) : (
            <table className="w-full min-w-[720px] bg-surface">
              <thead>
                <tr>
                  <th className="th">Ngày</th>
                  <th className="th">Hãng</th>
                  <th className="th">File</th>
                  <th className="th text-right">Hãng khai</th>
                  <th className="th text-right">Đã ghi nhận</th>
                  <th className="th text-center">Khớp</th>
                  <th className="th text-center">Lệch</th>
                  <th className="th text-center">Không thấy</th>
                </tr>
              </thead>
              <tbody>
                {lichSu.map((b) => (
                  <tr key={b.id}>
                    <td className="td whitespace-nowrap text-muted">{ngayGio(b.createdAt)}</td>
                    <td className="td font-semibold">{b.carrier}</td>
                    <td className="td font-mono text-[11px] text-muted">{b.fileName ?? "—"}</td>
                    <td className="td text-right tabular-nums">{tienVND(b.totalReported)}</td>
                    <td className="td text-right font-semibold tabular-nums">
                      {tienVND(b.totalMatched)}
                    </td>
                    <td className="td text-center tabular-nums">{b.matchedCount}</td>
                    <td
                      className={`td text-center tabular-nums ${b.diffCount ? "font-bold text-danger" : "text-muted"}`}
                    >
                      {b.diffCount}
                    </td>
                    <td className="td text-center tabular-nums text-muted">{b.missingCount}</td>
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
