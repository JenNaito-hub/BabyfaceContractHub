"use client";

import { useMemo, useState } from "react";
import {
  computeJobBreakdown,
  computeMonthlyStats,
  computePaymentStats,
  currentThang,
  formatThang,
  formatVND,
} from "@/lib/calculations";
import { BarChart, DonutChart } from "@/components/Charts";
import type { Casting, Job } from "@/lib/types";
import { exportMonthToExcel } from "@/lib/excel";

export default function DashboardClient({
  jobs,
  castings,
  talentNames,
}: {
  jobs: Job[];
  castings: Casting[];
  talentNames: Record<string, string>;
}) {
  const months = useMemo(() => {
    const set = new Set(jobs.map((j) => j.thang));
    const arr = Array.from(set).sort().reverse();
    return arr;
  }, [jobs]);

  const [thang, setThang] = useState<string>(() => {
    const now = currentThang();
    if (jobs.some((j) => j.thang === now)) return now;
    return jobs[0]?.thang ?? now;
  });

  const monthJobs = useMemo(() => jobs.filter((j) => j.thang === thang), [jobs, thang]);
  const monthJobIds = useMemo(() => new Set(monthJobs.map((j) => j.id)), [monthJobs]);
  const monthCastings = useMemo(
    () => castings.filter((c) => monthJobIds.has(c.job_id)),
    [castings, monthJobIds],
  );

  const stats = useMemo(() => computeMonthlyStats(monthCastings), [monthCastings]);
  const breakdown = useMemo(
    () => computeJobBreakdown(monthJobs, monthCastings),
    [monthJobs, monthCastings],
  );
  const payment = useMemo(() => computePaymentStats(monthCastings), [monthCastings]);

  const barData = breakdown.map((b) => ({ label: b.job.ten_job, value: b.tongThanhToan }));
  const donutData = breakdown.map((b) => ({ label: b.job.ten_job, value: b.luotCasting }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard tháng</h1>
          <p className="text-sm text-dark/60">Tổng quan casting &amp; thanh toán theo tháng</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input max-w-[180px]" value={thang} onChange={(e) => setThang(e.target.value)}>
            {months.length === 0 && <option value={thang}>{formatThang(thang)}</option>}
            {months.map((m) => (
              <option key={m} value={m}>
                {formatThang(m)}
              </option>
            ))}
          </select>
          <button
            className="btn-dark"
            onClick={() => exportMonthToExcel(thang, monthJobs, monthCastings, talentNames)}
            disabled={monthCastings.length === 0}
          >
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Lượt casting" value={stats.luotCasting} />
        <Stat label="Talent unique" value={stats.talentUnique} />
        <Stat label="Talent ≥2 job" value={stats.talentTrung} />
        <Stat label="Đậu" value={stats.soDau} />
        <Stat label="Tổng HĐ" value={formatVND(stats.tongHopDong)} />
        <Stat label="Tổng OT" value={formatVND(stats.tongOt)} />
        <Stat label="Tổng thanh toán" value={formatVND(stats.tongThanhToan)} accent />
        <Stat label="Số job" value={monthJobs.length} />
        <Stat label="Thuế TNCN khấu trừ" value={formatVND(payment.tongThue)} />
        <Stat label="Đã trả talent" value={formatVND(payment.daTraNet)} />
        <Stat
          label={`Còn phải trả (${payment.soDongChuaTra} dòng)`}
          value={formatVND(payment.conNoNet)}
          accent={payment.conNoNet > 0}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-display text-base font-bold">Thanh toán theo job</h3>
          <BarChart data={barData} valueFormatter={formatVND} />
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-base font-bold">Lượt casting theo job</h3>
          <DonutChart data={donutData} />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">Job</th>
              <th className="th">Khách hàng</th>
              <th className="th text-right">Lượt casting</th>
              <th className="th text-right">Đậu</th>
              <th className="th text-right">Thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.job.id} className="border-b border-dark/5 last:border-0">
                <td className="td font-semibold">{b.job.ten_job}</td>
                <td className="td text-dark/60">{b.job.khach_hang || "—"}</td>
                <td className="td text-right tabular-nums">{b.luotCasting}</td>
                <td className="td text-right tabular-nums">{b.soDau}</td>
                <td className="td text-right tabular-nums">{formatVND(b.tongThanhToan)}</td>
              </tr>
            ))}
            {breakdown.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-dark/40" colSpan={5}>
                  Không có job trong tháng này.
                </td>
              </tr>
            )}
          </tbody>
          {breakdown.length > 0 && (
            <tfoot>
              <tr className="border-t border-dark/10 font-semibold">
                <td className="td" colSpan={2}>
                  Tổng
                </td>
                <td className="td text-right tabular-nums">{stats.luotCasting}</td>
                <td className="td text-right tabular-nums">{stats.soDau}</td>
                <td className="td text-right tabular-nums">{formatVND(stats.tongThanhToan)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className={`card ${accent ? "bg-lime" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-dark/50">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}
