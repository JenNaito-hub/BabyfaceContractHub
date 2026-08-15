"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatCard, TrangThaiBadge } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatNgay, formatVND, ngayLocal } from "@/lib/sales/calc";
import { COD_FIELDS, doiSoat, tuDongMapCod, type CodMapping, type DongDoiSoat } from "@/lib/sales/cod";
import { docFile, type ParsedSheet } from "@/lib/sales/importers";
import type { Order } from "@/lib/sales/types";

const NHAN: Record<DongDoiSoat["trang_thai"], { text: string; cls: string }> = {
  khop: { text: "Khớp", cls: "bg-lime text-dark" },
  lech: { text: "Lệch tiền", cls: "bg-warning/15 text-warning" },
  khong_thay: { text: "Không thấy đơn", cls: "bg-dark/10 text-dark/60" },
  da_doi_soat: { text: "Đã đối soát", cls: "bg-dark/10 text-dark/40" },
};

export default function CodClient({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [tenFile, setTenFile] = useState("");
  const [mapping, setMapping] = useState<CodMapping>({});
  const [nhanLech, setNhanLech] = useState(false);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [ketQua, setKetQua] = useState<{ ok: number; loi: string[] } | null>(null);

  const dong = useMemo(() => {
    if (!sheet || !mapping.ma_van_don || !mapping.so_tien) return [];
    return doiSoat(sheet, mapping, orders);
  }, [sheet, mapping, orders]);

  const khop = dong.filter((d) => d.trang_thai === "khop");
  const lech = dong.filter((d) => d.trang_thai === "lech");
  const khongThay = dong.filter((d) => d.trang_thai === "khong_thay");
  const daRoi = dong.filter((d) => d.trang_thai === "da_doi_soat");

  const seGhi = nhanLech ? [...khop, ...lech] : khop;
  const tongTien = dong.reduce((s, d) => s + d.so_tien, 0);

  /** COD đang trên đường mà chưa thấy trong file đối soát → tiền còn treo. */
  const conTreo = useMemo(() => {
    const trongFile = new Set(dong.map((d) => d.order?.id).filter(Boolean));
    return orders.filter(
      (o) =>
        o.thanh_toan === "cod" &&
        !o.ngay_doi_soat &&
        !trongFile.has(o.id) &&
        (o.trang_thai === "dang_giao" || o.trang_thai === "hoan_thanh"),
    );
  }, [orders, dong]);

  async function chonFile(file: File) {
    setLoi(null);
    setKetQua(null);
    setTenFile(file.name);
    try {
      const parsed = await docFile(file);
      setSheet(parsed);
      setMapping(tuDongMapCod(parsed.headers));
    } catch (e) {
      setLoi(`Không đọc được file: ${(e as Error).message}`);
    }
  }

  async function ghiNhan() {
    if (!seGhi.length) return;
    setDangChay(true);
    setLoi(null);

    const supabase = createClient();
    const res = { ok: 0, loi: [] as string[] };
    const homNay = ngayLocal(new Date());

    for (const d of seGhi) {
      if (!d.order) continue;
      const { error } = await supabase
        .from("orders")
        .update({
          cod_da_thu: d.so_tien,
          ngay_doi_soat: d.ngay ? d.ngay.slice(0, 10) : homNay,
          thanh_toan: "da_thanh_toan",
          // Tiền đã về thì đơn coi như xong
          trang_thai: d.order.trang_thai === "dang_giao" ? "hoan_thanh" : d.order.trang_thai,
        })
        .eq("id", d.order.id);

      if (error) res.loi.push(`${d.ma_van_don}: ${error.message}`);
      else res.ok += 1;
    }

    setDangChay(false);
    setKetQua(res);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales/orders" className="text-xs font-semibold text-dark/50 underline">
          ← Đơn hàng
        </Link>
        <h1 className="mt-1 font-display text-2xl font-extrabold">Đối soát COD</h1>
        <p className="text-sm text-dark/60">
          Tải file đối soát của hãng vận chuyển (GHTK, GHN, Viettel Post…). Hệ thống khớp theo
          <strong> mã vận đơn</strong>, so tiền hãng trả với tổng đơn, rồi đánh dấu đã thu tiền.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="COD còn treo"
          value={formatVND(conTreo.reduce((s, o) => s + o.tong_tien, 0))}
          sub={`${conTreo.length} đơn chưa nhận tiền về`}
          accent
        />
        <StatCard label="Khớp" value={khop.length} sub="Sẵn sàng ghi nhận" />
        <StatCard label="Lệch tiền" value={lech.length} sub="Cần xem lại" />
        <StatCard label="Không thấy đơn" value={khongThay.length} sub="Mã vận đơn lạ" />
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">File đối soát (.xlsx / .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="input py-1.5"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) chonFile(f);
            }}
          />
        </div>

        {sheet && (
          <>
            <p className="text-xs text-dark/50">
              {tenFile} · {sheet.rows.length} dòng
              {tongTien > 0 && ` · tổng tiền trong file ${formatVND(tongTien)}`}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {COD_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label">
                    {f.label}
                    {f.required && <span className="text-warning"> *</span>}
                  </label>
                  <select
                    className="input"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}
                  >
                    <option value="">— không dùng —</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}
      </div>

      {dong.length > 0 && (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">Mã vận đơn</th>
                  <th className="th">Đơn hàng</th>
                  <th className="th text-right">Tổng đơn</th>
                  <th className="th text-right">Hãng trả</th>
                  <th className="th text-right">Lệch</th>
                  <th className="th">Ngày</th>
                  <th className="th">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {dong.slice(0, 300).map((d) => (
                  <tr key={d.ma_van_don} className="border-b border-dark/5">
                    <td className="td font-mono text-xs">{d.ma_van_don}</td>
                    <td className="td">
                      {d.order ? (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/sales/orders/${d.order.id}`}
                            className="font-semibold underline"
                          >
                            {d.order.ma_don}
                          </Link>
                          <TrangThaiBadge trangThai={d.order.trang_thai} />
                        </div>
                      ) : (
                        <span className="text-dark/40">—</span>
                      )}
                    </td>
                    <td className="td text-right">
                      {d.order ? formatVND(d.order.tong_tien) : "—"}
                    </td>
                    <td className="td text-right font-semibold">{formatVND(d.so_tien)}</td>
                    <td className={`td text-right ${d.lech !== 0 ? "text-warning" : "text-dark/40"}`}>
                      {d.lech === 0 ? "—" : (d.lech > 0 ? "+" : "") + formatVND(d.lech)}
                    </td>
                    <td className="td text-dark/60">{formatNgay(d.ngay)}</td>
                    <td className="td">
                      <span className={`badge ${NHAN[d.trang_thai].cls}`}>
                        {NHAN[d.trang_thai].text}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={nhanLech}
                onChange={(e) => setNhanLech(e.target.checked)}
              />
              <span>
                Ghi nhận cả {lech.length} đơn lệch tiền
                <span className="block text-xs text-dark/50">
                  Số tiền lưu là số hãng thực trả, chênh lệch giữ nguyên để đối chiếu sau.
                </span>
              </span>
            </label>

            <div className="flex items-center gap-3">
              {daRoi.length > 0 && (
                <span className="text-xs text-dark/50">{daRoi.length} đơn đã đối soát trước đó</span>
              )}
              {ketQua && (
                <span className="text-sm">
                  Đã ghi nhận <strong>{ketQua.ok}</strong> đơn
                  {ketQua.loi.length > 0 && (
                    <span className="text-warning"> · {ketQua.loi.length} lỗi</span>
                  )}
                </span>
              )}
              <button
                className="btn-primary"
                onClick={ghiNhan}
                disabled={dangChay || seGhi.length === 0}
              >
                {dangChay ? "Đang ghi…" : `Ghi nhận ${seGhi.length} đơn đã thu tiền`}
              </button>
            </div>
          </div>

          {ketQua && ketQua.loi.length > 0 && (
            <div className="card border-warning/40">
              <h2 className="mb-2 font-display font-extrabold text-warning">Lỗi khi ghi nhận</h2>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
                {ketQua.loi.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {conTreo.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-display font-extrabold">COD còn treo</h2>
          <p className="mb-3 text-xs text-dark/50">
            Đơn COD đã giao hoặc đang giao nhưng tiền chưa về. Đối chiếu với hãng vận chuyển nếu
            để lâu.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">Đơn</th>
                  <th className="th">Vận đơn</th>
                  <th className="th">Ngày đặt</th>
                  <th className="th">Trạng thái</th>
                  <th className="th text-right">Tiền thu hộ</th>
                </tr>
              </thead>
              <tbody>
                {conTreo.slice(0, 100).map((o) => (
                  <tr key={o.id} className="border-b border-dark/5">
                    <td className="td">
                      <Link href={`/sales/orders/${o.id}`} className="font-semibold underline">
                        {o.ma_don}
                      </Link>
                    </td>
                    <td className="td font-mono text-xs">{o.ma_van_don}</td>
                    <td className="td text-dark/60">{formatNgay(o.ngay_dat)}</td>
                    <td className="td">
                      <TrangThaiBadge trangThai={o.trang_thai} />
                    </td>
                    <td className="td text-right font-semibold">{formatVND(o.tong_tien)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
