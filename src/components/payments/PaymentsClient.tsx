"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  castingPayout,
  computePaymentStats,
  formatNgay,
  formatThang,
  formatVND,
  netPayout,
  suggestKhauTruThue,
} from "@/lib/calculations";
import { exportPaymentsToExcel } from "@/lib/excel";
import { PHUONG_THUC_TT, type CastingFull, type PhuongThucTT, type TrangThaiTT } from "@/lib/types";

type StatusFilter = "all" | TrangThaiTT;

export default function PaymentsClient({
  castings,
  isManager,
  currentUserId,
}: {
  castings: CastingFull[];
  isManager: boolean;
  currentUserId: string | null;
}) {
  const [rows, setRows] = useState<CastingFull[]>(castings);
  const [thang, setThang] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const months = useMemo(() => {
    const set = new Set(rows.map((r) => r.job?.thang).filter(Boolean) as string[]);
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (thang !== "all" && r.job?.thang !== thang) return false;
      if (status !== "all" && r.trang_thai_tt !== status) return false;
      if (!q) return true;
      return [r.talent?.ho_ten, r.job?.ten_job, r.vai]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, thang, status, query]);

  const stats = useMemo(() => computePaymentStats(filtered), [filtered]);

  const selectedUnpaid = useMemo(
    () => filtered.filter((r) => selected.has(r.id) && r.trang_thai_tt !== "Đã trả"),
    [filtered, selected],
  );

  function patchLocal(id: string, patch: Partial<CastingFull>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save(id: string, patch: Partial<CastingFull>) {
    const prev = rows.find((r) => r.id === id);
    patchLocal(id, patch);
    // Cột join `talent`/`job` không thuộc bảng castings — loại trước khi update.
    const { talent: _t, job: _j, ...dbPatch } = patch as Record<string, unknown> & {
      talent?: unknown;
      job?: unknown;
    };
    const supabase = createClient();
    const { error } = await supabase.from("castings").update(dbPatch).eq("id", id);
    if (error) {
      alert("Lỗi lưu: " + error.message);
      if (prev) patchLocal(id, prev);
    }
  }

  async function markPaid(ids: string[]) {
    if (ids.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const patch = {
      trang_thai_tt: "Đã trả" as TrangThaiTT,
      ngay_thanh_toan: today,
      paid_by: currentUserId,
    };
    setBusy(true);
    const prev = rows;
    setRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, ...patch } : r)));
    const supabase = createClient();
    const { error } = await supabase.from("castings").update(patch).in("id", ids);
    setBusy(false);
    if (error) {
      alert("Không đánh dấu được: " + error.message);
      setRows(prev);
      return;
    }
    setSelected(new Set());
  }

  async function unmarkPaid(id: string) {
    await save(id, {
      trang_thai_tt: "Chưa trả",
      ngay_thanh_toan: null,
      paid_by: null,
    });
  }

  /** Điền thuế TNCN 10% gợi ý cho các dòng đang lọc chưa nhập thuế. */
  async function fillSuggestedTax() {
    const targets = filtered.filter(
      (r) => Number(r.khau_tru_thue ?? 0) === 0 && suggestKhauTruThue(castingPayout(r)) > 0,
    );
    if (targets.length === 0) {
      alert("Không có dòng nào cần điền thuế (dưới ngưỡng 2.000.000đ hoặc đã nhập).");
      return;
    }
    if (
      !confirm(
        `Điền thuế TNCN 10% cho ${targets.length} dòng có chi trả ≥ 2.000.000đ? Có thể sửa lại từng dòng sau.`,
      )
    )
      return;

    setBusy(true);
    const supabase = createClient();
    for (const r of targets) {
      const thue = suggestKhauTruThue(castingPayout(r));
      const { error } = await supabase
        .from("castings")
        .update({ khau_tru_thue: thue })
        .eq("id", r.id);
      if (error) {
        setBusy(false);
        alert("Lỗi khi điền thuế: " + error.message);
        return;
      }
      patchLocal(r.id, { khau_tru_thue: thue });
    }
    setBusy(false);
  }

  function toggleAll() {
    setSelected((s) =>
      s.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)),
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Thanh toán talent</h1>
          <p className="text-sm text-dark/60">
            Công nợ cát-xê &amp; khấu trừ thuế TNCN 10% — chỉ tính casting <b>Đậu</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={fillSuggestedTax} disabled={busy}>
            Điền thuế 10% gợi ý
          </button>
          <button
            className="btn-dark"
            onClick={() => exportPaymentsToExcel(thang, filtered)}
            disabled={filtered.length === 0}
          >
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tổng chi trả (gộp)" value={formatVND(stats.tongGross)} />
        <Stat label="Thuế TNCN khấu trừ" value={formatVND(stats.tongThue)} />
        <Stat label="Đã trả" value={formatVND(stats.daTraNet)} />
        <Stat
          label={`Còn phải trả (${stats.soDongChuaTra} dòng)`}
          value={formatVND(stats.conNoNet)}
          accent
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input max-w-[180px]" value={thang} onChange={(e) => setThang(e.target.value)}>
          <option value="all">Tất cả tháng</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatThang(m)}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg bg-dark/5 p-1 text-sm font-semibold">
          {(["all", "Chưa trả", "Đã trả"] as const).map((s) => (
            <button
              key={s}
              className={`rounded-md px-3 py-1.5 ${status === s ? "bg-white shadow-sm" : "text-dark/50"}`}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "Tất cả" : s}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          placeholder="Tìm talent, job, vai…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {selectedUnpaid.length > 0 && (
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => markPaid(selectedUnpaid.map((r) => r.id))}
          >
            Đánh dấu đã trả ({selectedUnpaid.length})
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1040px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả"
                />
              </th>
              <th className="th">Talent</th>
              <th className="th">Job</th>
              <th className="th text-right">Tiền HĐ</th>
              <th className="th text-right">OT</th>
              <th className="th text-right">Thuế TNCN</th>
              <th className="th text-right">Thực nhận</th>
              <th className="th">Hình thức</th>
              <th className="th">Trạng thái</th>
              <th className="th text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const gross = castingPayout(r);
              const goiY = suggestKhauTruThue(gross);
              return (
                <tr key={r.id} className="border-b border-dark/5 last:border-0">
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                      aria-label={`Chọn ${r.talent?.ho_ten ?? ""}`}
                    />
                  </td>
                  <td className="td font-semibold">
                    {r.talent?.ho_ten ?? "—"}
                    {r.vai && <div className="text-xs font-normal text-dark/40">{r.vai}</div>}
                  </td>
                  <td className="td">
                    {r.job ? (
                      <Link href={`/talent/jobs/${r.job.id}`} className="hover:underline">
                        {r.job.ten_job}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="text-xs text-dark/40">
                      {r.job?.thang ? formatThang(r.job.thang) : ""}
                    </div>
                  </td>
                  <td className="td text-right tabular-nums">{formatVND(r.so_tien_hd)}</td>
                  <td className="td text-right tabular-nums">{formatVND(r.chi_phi_ot)}</td>
                  <td className="td">
                    <input
                      type="number"
                      min={0}
                      className="input py-1 text-right"
                      defaultValue={r.khau_tru_thue ?? 0}
                      title={goiY ? `Gợi ý 10%: ${formatVND(goiY)}` : "Dưới ngưỡng 2.000.000đ"}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        if (v !== Number(r.khau_tru_thue ?? 0)) save(r.id, { khau_tru_thue: v });
                      }}
                    />
                  </td>
                  <td className="td text-right font-semibold tabular-nums">
                    {formatVND(netPayout(r))}
                  </td>
                  <td className="td">
                    <select
                      className="input py-1"
                      value={r.phuong_thuc_tt ?? ""}
                      onChange={(e) =>
                        save(r.id, {
                          phuong_thuc_tt: (e.target.value || null) as PhuongThucTT | null,
                        })
                      }
                    >
                      <option value="">—</option>
                      {PHUONG_THUC_TT.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    {r.trang_thai_tt === "Đã trả" ? (
                      <div>
                        <span className="badge bg-lime text-dark">Đã trả</span>
                        <div className="text-xs text-dark/40">{formatNgay(r.ngay_thanh_toan)}</div>
                      </div>
                    ) : (
                      <span className="badge bg-warning/15 text-warning">Chưa trả</span>
                    )}
                  </td>
                  <td className="td text-right">
                    {r.trang_thai_tt === "Đã trả" ? (
                      isManager ? (
                        <button
                          className="text-xs text-dark/50 hover:underline"
                          onClick={() => unmarkPaid(r.id)}
                        >
                          Bỏ đánh dấu
                        </button>
                      ) : (
                        <span className="text-xs text-dark/30">—</span>
                      )
                    ) : (
                      <button
                        className="btn-primary px-2.5 py-1 text-xs"
                        disabled={busy}
                        onClick={() => markPaid([r.id])}
                      >
                        Đã trả
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-dark/40" colSpan={10}>
                  Không có khoản chi trả nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-dark/50">
        Thuế TNCN gợi ý = 10% khi tổng chi trả 1 lần ≥ 2.000.000đ (cá nhân không ký HĐLĐ). Talent có
        cam kết thu nhập dưới ngưỡng chịu thuế thì để 0.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card ${accent ? "bg-lime" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-dark/50">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}
