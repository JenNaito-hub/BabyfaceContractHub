"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatThang } from "@/lib/calculations";
import Modal from "@/components/Modal";
import type { Job } from "@/lib/types";

export default function JobsClient({
  jobs,
  castingCounts,
}: {
  jobs: Job[];
  castingCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Job | null>(null);
  const [creating, setCreating] = useState(false);

  const months = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.thang))).sort().reverse();
  }, [jobs]);

  const grouped = useMemo(() => {
    const visible = monthFilter === "all" ? jobs : jobs.filter((j) => j.thang === monthFilter);
    const map = new Map<string, Job[]>();
    for (const j of visible) {
      if (!map.has(j.thang)) map.set(j.thang, []);
      map.get(j.thang)!.push(j);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [jobs, monthFilter]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Jobs</h1>
          <p className="text-sm text-dark/60">{jobs.length} job</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Thêm job
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            monthFilter === "all" ? "bg-dark text-paper" : "bg-dark/5 text-dark/60"
          }`}
          onClick={() => setMonthFilter("all")}
        >
          Tất cả
        </button>
        {months.map((m) => (
          <button
            key={m}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              monthFilter === m ? "bg-dark text-paper" : "bg-dark/5 text-dark/60"
            }`}
            onClick={() => setMonthFilter(m)}
          >
            {formatThang(m)}
          </button>
        ))}
      </div>

      {grouped.length === 0 && (
        <div className="card text-center text-dark/40">Chưa có job nào. Bấm “Thêm job”.</div>
      )}

      <div className="space-y-6">
        {grouped.map(([thang, list]) => (
          <div key={thang}>
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-dark/50">
              {formatThang(thang)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((j) => (
                <div key={j.id} className="card flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/talent/jobs/${j.id}`} className="font-semibold hover:underline">
                      {j.ten_job}
                    </Link>
                    <button
                      className="text-xs text-dark/40 hover:text-dark"
                      onClick={() => setEditing(j)}
                    >
                      Sửa
                    </button>
                  </div>
                  <div className="mt-1 space-y-0.5 text-sm text-dark/60">
                    {j.khach_hang && <div>KH: {j.khach_hang}</div>}
                    {j.ngay_shooting && <div>Ngày: {j.ngay_shooting}</div>}
                    {j.dia_diem && <div>Nơi: {j.dia_diem}</div>}
                    {j.pm && <div>PM: {j.pm}</div>}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-dark/5 pt-3">
                    <span className="badge bg-dark/5 text-dark/60">
                      {castingCounts[j.id] ?? 0} casting
                    </span>
                    <Link href={`/talent/jobs/${j.id}`} className="text-sm font-semibold text-dark hover:underline">
                      Quản lý →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <JobModal
          job={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function JobModal({
  job,
  onClose,
  onSaved,
}: {
  job: Job | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const isEdit = !!job;
  const [form, setForm] = useState({
    thang: job?.thang ?? defaultThang(),
    ten_job: job?.ten_job ?? "",
    khach_hang: job?.khach_hang ?? "",
    ngay_shooting: job?.ngay_shooting ?? "",
    dia_diem: job?.dia_diem ?? "",
    pm: job?.pm ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ten_job.trim() || !form.thang) {
      setError("Tên job và tháng là bắt buộc.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      thang: form.thang,
      ten_job: form.ten_job.trim(),
      khach_hang: form.khach_hang.trim() || null,
      ngay_shooting: form.ngay_shooting.trim() || null,
      dia_diem: form.dia_diem.trim() || null,
      pm: form.pm.trim() || null,
    };
    const { error } = isEdit
      ? await supabase.from("jobs").update(payload).eq("id", job!.id)
      : await supabase.from("jobs").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!job) return;
    if (!confirm(`Xoá job "${job.ten_job}" và toàn bộ casting của nó?`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
    onSaved();
  }

  return (
    <Modal
      title={isEdit ? "Sửa job" : "Thêm job"}
      onClose={onClose}
      footer={
        <>
          {isEdit && (
            <button className="btn-danger mr-auto" type="button" onClick={remove} disabled={saving}>
              Xoá job
            </button>
          )}
          <button className="btn-ghost" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn-primary" form="job-form" type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <form id="job-form" onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tháng *</label>
            <input type="month" className="input" value={form.thang} onChange={(e) => set("thang", e.target.value)} />
          </div>
          <div>
            <label className="label">Ngày shooting</label>
            <input className="input" value={form.ngay_shooting} onChange={(e) => set("ngay_shooting", e.target.value)} placeholder="12/07 hoặc 12-14/07" />
          </div>
        </div>
        <div>
          <label className="label">Tên job *</label>
          <input className="input" value={form.ten_job} onChange={(e) => set("ten_job", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Khách hàng</label>
            <input className="input" value={form.khach_hang} onChange={(e) => set("khach_hang", e.target.value)} />
          </div>
          <div>
            <label className="label">PM</label>
            <input className="input" value={form.pm} onChange={(e) => set("pm", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Địa điểm</label>
          <input className="input" value={form.dia_diem} onChange={(e) => set("dia_diem", e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p>}
      </form>
    </Modal>
  );
}

function defaultThang(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
