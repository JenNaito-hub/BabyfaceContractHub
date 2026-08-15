"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  currentThang,
  findScheduleConflicts,
  formatNgay,
  formatThang,
  jobDates,
} from "@/lib/calculations";
import type { Casting, Job } from "@/lib/types";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Số ô trống trước ngày 1 để tuần bắt đầu từ Thứ 2. */
function leadingBlanks(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=CN
  return (dow + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftThang(thang: string, delta: number): string {
  const [y, m] = thang.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function LichClient({
  jobs,
  castings,
  talentNames,
}: {
  jobs: Job[];
  castings: Casting[];
  talentNames: Record<string, string>;
}) {
  const [thang, setThang] = useState<string>(currentThang);
  const [year, month] = useMemo(() => thang.split("-").map(Number), [thang]);

  /** ngày 'YYYY-MM-DD' -> danh sách job diễn ra hôm đó */
  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const j of jobs) {
      for (const ngay of jobDates(j)) {
        if (!map.has(ngay)) map.set(ngay, []);
        map.get(ngay)!.push(j);
      }
    }
    return map;
  }, [jobs]);

  const dauCountByJob = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of castings) {
      if (c.ket_qua !== "Đậu") continue;
      map.set(c.job_id, (map.get(c.job_id) ?? 0) + 1);
    }
    return map;
  }, [castings]);

  const conflicts = useMemo(() => findScheduleConflicts(jobs, castings), [jobs, castings]);
  const monthConflicts = useMemo(
    () => conflicts.filter((c) => c.ngay.startsWith(thang)),
    [conflicts, thang],
  );

  /** Job đã có casting nhưng chưa điền ngày -> không lên lịch được. */
  const jobsThieuNgay = useMemo(
    () => jobs.filter((j) => !j.ngay_bat_dau && j.thang === thang),
    [jobs, thang],
  );

  const cells = useMemo(() => {
    const blanks = leadingBlanks(year, month);
    const total = daysInMonth(year, month);
    const out: (string | null)[] = Array.from({ length: blanks }, () => null);
    for (let d = 1; d <= total; d++) {
      out.push(`${thang}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month, thang]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Lịch shooting</h1>
          <p className="text-sm text-dark/60">
            Lịch job theo ngày &amp; cảnh báo talent bị đặt trùng lịch
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3" onClick={() => setThang((t) => shiftThang(t, -1))}>
            ←
          </button>
          <input
            type="month"
            className="input max-w-[160px]"
            value={thang}
            onChange={(e) => e.target.value && setThang(e.target.value)}
          />
          <button className="btn-ghost px-3" onClick={() => setThang((t) => shiftThang(t, 1))}>
            →
          </button>
        </div>
      </div>

      {monthConflicts.length > 0 && (
        <div className="card mb-5 border-warning/40 bg-warning/5">
          <h2 className="mb-3 font-display text-base font-bold text-warning">
            ⚠ {monthConflicts.length} trùng lịch trong {formatThang(thang)}
          </h2>
          <ul className="space-y-2 text-sm">
            {monthConflicts.map((c) => (
              <li key={`${c.talentId}-${c.ngay}`} className="flex flex-wrap items-center gap-x-2">
                <span className="font-semibold">{talentNames[c.talentId] ?? c.talentId}</span>
                <span className="text-dark/60">bị đặt {c.jobs.length} job ngày</span>
                <span className="font-semibold">{formatNgay(c.ngay)}</span>
                <span className="text-dark/60">—</span>
                {c.jobs.map((j, i) => (
                  <span key={j.id}>
                    <Link href={`/talent/jobs/${j.id}`} className="underline hover:no-underline">
                      {j.ten_job}
                    </Link>
                    {i < c.jobs.length - 1 && <span className="text-dark/40">, </span>}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto p-3">
        <div className="grid min-w-[700px] grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-dark/40"
            >
              {w}
            </div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b-${i}`} className="min-h-[92px] rounded-lg bg-dark/[0.02]" />;
            const dayJobs = jobsByDay.get(iso) ?? [];
            const hasConflict = monthConflicts.some((c) => c.ngay === iso);
            return (
              <div
                key={iso}
                className={`min-h-[92px] rounded-lg border p-1.5 ${
                  hasConflict
                    ? "border-warning/50 bg-warning/5"
                    : dayJobs.length
                      ? "border-dark/10 bg-white"
                      : "border-dark/5 bg-white"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-semibold ${
                    iso === todayISO
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-dark text-paper"
                      : "text-dark/40"
                  }`}
                >
                  {Number(iso.slice(8))}
                </div>
                <div className="space-y-1">
                  {dayJobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/talent/jobs/${j.id}`}
                      className="block truncate rounded bg-lime px-1.5 py-0.5 text-[11px] font-semibold text-dark hover:brightness-95"
                      title={`${j.ten_job}${j.call_time ? ` · call ${j.call_time}` : ""} · ${
                        dauCountByJob.get(j.id) ?? 0
                      } talent đậu`}
                    >
                      {j.ten_job}
                      <span className="font-normal text-dark/60">
                        {" "}
                        ({dauCountByJob.get(j.id) ?? 0})
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {jobsThieuNgay.length > 0 && (
        <div className="card mt-5">
          <h2 className="mb-2 font-display text-base font-bold">Job chưa có ngày shooting</h2>
          <p className="mb-3 text-sm text-dark/60">
            Job thiếu ngày bắt đầu sẽ không lên lịch và không được kiểm tra trùng. Vào job để bổ
            sung.
          </p>
          <div className="flex flex-wrap gap-2">
            {jobsThieuNgay.map((j) => (
              <Link
                key={j.id}
                href={`/talent/jobs/${j.id}`}
                className="badge bg-dark/5 text-dark/70 hover:bg-dark/10"
              >
                {j.ten_job}
                {j.ngay_shooting ? ` · “${j.ngay_shooting}”` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
