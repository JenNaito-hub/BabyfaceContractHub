"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  COD_FIELDS,
  docFile,
  doiSoat,
  NHAN_DOI_SOAT,
  tuDongMapCod,
  type CodField,
  type CodMapping,
  type DonDeDoiSoat,
  type DongDoiSoat,
  type ParsedSheet,
} from "@aescentic/marketplace";
import { tienVND } from "./Bits";

type DonCod = DonDeDoiSoat & { carrier: string | null; placedAt: string };
type ChotDong = {
  orderId: string;
  trackingCode: string;
  soTien: number;
  soTienDuKien: number;
  trangThai: string;
};

export default function DoiSoatClient({
  hang,
  dons,
  chotDoiSoat,
}: {
  hang: { carrier: string; soDon: number; tongTien: number }[];
  dons: DonCod[];
  chotDoiSoat: (p: {
    carrier: string;
    fileName?: string;
    chot: ChotDong[];
    tatCa: ChotDong[];
  }) => Promise<{ ok: true; daChot: number; tongTien: number } | { ok: false; loi: string }>;
}) {
  const router = useRouter();
  const [dangChay, batDau] = useTransition();

  const [carrier, setCarrier] = useState(hang[0]?.carrier ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [tenFile, setTenFile] = useState("");
  const [mapping, setMapping] = useState<CodMapping>({});
  const [boChon, setBoChon] = useState<Set<string>>(new Set());
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<{ daChot: number; tongTien: number } | null>(null);

  const donCuaHang = useMemo(
    () => dons.filter((d) => (d.carrier ?? "(không ghi hãng)") === carrier),
    [dons, carrier],
  );

  const ketQua: DongDoiSoat[] = useMemo(() => {
    if (!sheet) return [];
    return doiSoat(sheet, mapping, donCuaHang);
  }, [sheet, mapping, donCuaHang]);

  const khop = ketQua.filter((r) => r.trangThai === "khop");
  const lech = ketQua.filter((r) => r.trangThai === "lech");
  const khongThay = ketQua.filter((r) => r.trangThai === "khong_thay");
  const thieuCot = COD_FIELDS.filter((f) => f.required && !mapping[f.key]);

  // Dòng khớp được chọn sẵn; dòng lệch phải người dùng tự tick sau khi xem
  const chonMacDinh = useMemo(() => new Set(khop.map((r) => r.maVanDon)), [ketQua]);
  const dangChon = sheet && boChon.size === 0 ? chonMacDinh : boChon;

  const tongChot = ketQua
    .filter((r) => dangChon.has(r.maVanDon) && r.don)
    .reduce((s, r) => s + r.soTien, 0);
  const soChot = ketQua.filter((r) => dangChon.has(r.maVanDon) && r.don).length;

  const tienHangKhai = ketQua.reduce((s, r) => s + r.soTien, 0);

  function doiChon(ma: string) {
    const next = new Set(dangChon);
    if (next.has(ma)) next.delete(ma);
    else next.add(ma);
    setBoChon(next);
  }

  async function chonFile(f: File | null) {
    setLoi(null);
    setXong(null);
    setBoChon(new Set());
    if (!f) return;
    try {
      const s = await docFile(f);
      if (!s.rows.length) {
        setLoi("File không có dòng dữ liệu nào đọc được.");
        return;
      }
      setSheet(s);
      setTenFile(f.name);
      setMapping(tuDongMapCod(s.headers));
    } catch (e) {
      setLoi(`Không đọc được file: ${(e as Error).message}`);
    }
  }

  function chot() {
    const chotDs: ChotDong[] = ketQua
      .filter((r) => dangChon.has(r.maVanDon) && r.don)
      .map((r) => ({
        orderId: r.don!.id,
        trackingCode: r.maVanDon,
        soTien: r.soTien,
        soTienDuKien: r.don!.total,
        trangThai: r.trangThai,
      }));
    if (!chotDs.length) return;

    setLoi(null);
    batDau(async () => {
      const kq = await chotDoiSoat({
        carrier,
        fileName: tenFile,
        chot: chotDs,
        tatCa: ketQua.map((r) => ({
          orderId: r.don?.id ?? "",
          trackingCode: r.maVanDon,
          soTien: r.soTien,
          soTienDuKien: r.don?.total ?? 0,
          trangThai: r.trangThai,
        })),
      });
      if (!kq.ok) {
        setLoi(kq.loi);
        return;
      }
      setXong({ daChot: kq.daChot, tongTien: kq.tongTien });
      setSheet(null);
      setTenFile("");
      setBoChon(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-px bg-line sm:grid-cols-3">
        {hang.slice(0, 3).map((h) => (
          <div key={h.carrier} className="bg-surface p-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
              {h.carrier}
            </div>
            <div className="mt-1 text-xl font-extrabold tabular-nums">{tienVND(h.tongTien)}</div>
            <div className="text-xs text-muted">{h.soDon} đơn chờ về</div>
          </div>
        ))}
        {hang.length === 0 && (
          <div className="bg-surface p-6 text-sm text-muted sm:col-span-3">
            Không có đơn COD nào đang chờ đối soát.
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="label">Hãng vận chuyển</span>
          <select
            className="input"
            value={carrier}
            onChange={(e) => {
              setCarrier(e.target.value);
              setBoChon(new Set());
            }}
          >
            {hang.map((h) => (
              <option key={h.carrier} value={h.carrier}>
                {h.carrier} ({h.soDon} đơn)
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2 self-end text-sm text-muted">
          Đang đối chiếu với <strong>{donCuaHang.length}</strong> đơn COD chưa nhận tiền của{" "}
          {carrier || "—"}.
        </div>
      </div>

      <div className="border-2 border-dashed border-line bg-surface p-6 text-center">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={(e) => chonFile(e.target.files?.[0] ?? null)}
          className="mx-auto block text-sm"
        />
        <p className="mt-2 text-xs text-muted">
          Tải file sao kê hãng gửi kèm khi chuyển khoản. Nhận .xlsx, .xls và .csv.
        </p>
        {tenFile && (
          <p className="mt-2 font-mono text-[11px]">
            {tenFile} · {sheet?.rows.length ?? 0} dòng
          </p>
        )}
      </div>

      {loi && <p className="border-l-[3px] border-danger bg-surface px-4 py-3 text-sm">{loi}</p>}

      {xong && (
        <div className="border-l-[3px] border-accent bg-surface px-4 py-3 text-sm">
          <strong>Đối soát xong.</strong> Đã ghi nhận {xong.daChot} đơn, tổng{" "}
          {tienVND(xong.tongTien)}. Những đơn này chuyển sang <em>đã thanh toán</em>.
        </div>
      )}

      {sheet && (
        <>
          <section>
            <h2 className="mb-1 font-bold">Ghép cột</h2>
            <p className="mb-3 text-xs text-muted">
              Mỗi hãng đặt tên cột một kiểu. Đoán sai thì chọn lại ở đây.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {COD_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label">
                    {f.label}
                    {f.required && <span className="text-danger"> *</span>}
                  </span>
                  <select
                    className="input"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.key as CodField]: e.target.value || undefined }))
                    }
                  >
                    <option value="">— bỏ qua —</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          {thieuCot.length > 0 && (
            <p className="border-l-[3px] border-danger bg-surface px-4 py-3 text-sm">
              Chưa ghép cột bắt buộc: {thieuCot.map((f) => f.label).join(", ")}.
            </p>
          )}

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-bold">Kết quả đối chiếu</h2>
                <p className="text-sm text-muted">
                  Hãng khai {tienVND(tienHangKhai)} · <strong>{khop.length} khớp</strong>
                  {lech.length > 0 && ` · ${lech.length} lệch tiền`}
                  {khongThay.length > 0 && ` · ${khongThay.length} không tìm thấy đơn`}
                </p>
              </div>
              <button
                className="btn-dark"
                disabled={dangChay || !soChot || thieuCot.length > 0}
                onClick={chot}
              >
                {dangChay ? "Đang ghi…" : `Ghi nhận ${soChot} đơn · ${tienVND(tongChot)}`}
              </button>
            </div>

            {lech.length > 0 && (
              <p className="mb-3 border-l-[3px] border-danger bg-surface px-4 py-3 text-sm">
                {lech.length} đơn hãng trả không đúng số tiền. Chúng <strong>không</strong> được
                chọn sẵn — xem lý do rồi tự tick nếu vẫn muốn ghi nhận.
              </p>
            )}

            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[820px] bg-surface">
                <thead>
                  <tr>
                    <th className="th w-10"></th>
                    <th className="th">Mã vận đơn</th>
                    <th className="th">Đơn hàng</th>
                    <th className="th">Khách</th>
                    <th className="th text-right">Hãng trả</th>
                    <th className="th text-right">Đơn ghi</th>
                    <th className="th text-right">Lệch</th>
                    <th className="th">Tình trạng</th>
                  </tr>
                </thead>
                <tbody>
                  {ketQua.slice(0, 200).map((r) => (
                    <tr
                      key={r.maVanDon}
                      className={r.trangThai === "lech" ? "bg-danger/[0.04]" : ""}
                    >
                      <td className="td">
                        <input
                          type="checkbox"
                          disabled={!r.don || r.trangThai === "da_doi_soat"}
                          checked={dangChon.has(r.maVanDon)}
                          onChange={() => doiChon(r.maVanDon)}
                        />
                      </td>
                      <td className="td font-mono text-xs">{r.maVanDon}</td>
                      <td className="td font-mono text-xs">{r.don?.code ?? "—"}</td>
                      <td className="td">
                        <div className="max-w-[150px] truncate">{r.don?.customerName ?? "—"}</div>
                      </td>
                      <td className="td text-right tabular-nums">{tienVND(r.soTien)}</td>
                      <td className="td text-right tabular-nums text-muted">
                        {r.don ? tienVND(r.don.total) : "—"}
                      </td>
                      <td
                        className={`td text-right font-semibold tabular-nums ${
                          r.lech !== 0 ? "text-danger" : "text-muted"
                        }`}
                      >
                        {r.lech === 0 ? "—" : (r.lech > 0 ? "+" : "") + tienVND(r.lech)}
                      </td>
                      <td className="td">
                        <span
                          className={`pill ${
                            r.trangThai === "khop"
                              ? "bg-chip text-ink"
                              : r.trangThai === "lech"
                                ? "bg-danger/15 text-danger"
                                : "bg-line text-muted"
                          }`}
                        >
                          {NHAN_DOI_SOAT[r.trangThai]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ketQua.length > 200 && (
              <p className="mt-2 text-xs text-muted">
                Đang xem 200 dòng đầu trong {ketQua.length} dòng.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
