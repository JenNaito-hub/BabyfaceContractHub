"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { castingPayout, formatThang, formatVND } from "@/lib/calculations";
import { KetQuaBadge } from "@/components/Badges";
import type { CastingWithTalent, Job, KetQua, CoOt, Talent } from "@/lib/types";

export default function JobDetailClient({
  job,
  castings,
  talents,
}: {
  job: Job;
  castings: CastingWithTalent[];
  talents: Pick<Talent, "id" | "ho_ten" | "status">[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CastingWithTalent[]>(castings);
  const [adding, setAdding] = useState(false);
  const [pickTalent, setPickTalent] = useState("");
  const [talentQuery, setTalentQuery] = useState("");
  const [savingRow, setSavingRow] = useState<string | null>(null);

  const usedTalentIds = useMemo(() => new Set(rows.map((r) => r.talent_id)), [rows]);
  const availableTalents = useMemo(() => {
    const q = talentQuery.trim().toLowerCase();
    return talents
      .filter((t) => !usedTalentIds.has(t.id))
      .filter((t) => (q ? t.ho_ten.toLowerCase().includes(q) : true));
  }, [talents, usedTalentIds, talentQuery]);

  const totals = useMemo(() => {
    let dau = 0;
    let tien = 0;
    for (const r of rows) {
      if (r.ket_qua === "Đậu") {
        dau += 1;
        tien += castingPayout(r);
      }
    }
    return { dau, tien };
  }, [rows]);

  async function addCasting() {
    if (!pickTalent) return;
    setAdding(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("castings")
      .insert({ job_id: job.id, talent_id: pickTalent })
      .select("*, talent:talents(id, ho_ten, status)")
      .single();
    setAdding(false);
    if (error) {
      alert("Không thêm được: " + error.message);
      return;
    }
    setRows((r) => [...r, data as CastingWithTalent]);
    setPickTalent("");
    setTalentQuery("");
  }

  function patchLocal(id: string, patch: Partial<CastingWithTalent>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function saveField(id: string, patch: Partial<CastingWithTalent>) {
    patchLocal(id, patch);
    setSavingRow(id);
    const supabase = createClient();
    const { error } = await supabase.from("castings").update(patch).eq("id", id);
    setSavingRow(null);
    if (error) {
      alert("Lỗi lưu: " + error.message);
      router.refresh();
    }
  }

  async function removeCasting(id: string) {
    if (!confirm("Xoá talent khỏi job này?")) return;
    const prev = rows;
    setRows((r) => r.filter((row) => row.id !== id));
    const supabase = createClient();
    const { error } = await supabase.from("castings").delete().eq("id", id);
    if (error) {
      alert("Không xoá được: " + error.message);
      setRows(prev);
    }
  }

  return (
    <div>
      <Link href="/talent/jobs" className="text-sm text-dark/50 hover:underline">
        ← Về danh sách jobs
      </Link>

      <div className="mt-2 mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-dark/40">
            {formatThang(job.thang)}
          </div>
          <h1 className="text-2xl font-extrabold">{job.ten_job}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-dark/60">
            {job.khach_hang && <span>KH: {job.khach_hang}</span>}
            {job.ngay_shooting && <span>Ngày: {job.ngay_shooting}</span>}
            {job.dia_diem && <span>Nơi: {job.dia_diem}</span>}
            {job.pm && <span>PM: {job.pm}</span>}
          </div>
        </div>
        <div className="flex gap-3 text-right">
          <div className="card px-4 py-2">
            <div className="text-xs text-dark/50">Casting</div>
            <div className="font-display text-xl font-extrabold">{rows.length}</div>
          </div>
          <div className="card px-4 py-2">
            <div className="text-xs text-dark/50">Đậu</div>
            <div className="font-display text-xl font-extrabold">{totals.dau}</div>
          </div>
          <div className="card px-4 py-2">
            <div className="text-xs text-dark/50">Thanh toán</div>
            <div className="font-display text-xl font-extrabold">{formatVND(totals.tien)}</div>
          </div>
        </div>
      </div>

      <div className="card mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label">Thêm talent vào job</label>
          <input
            className="input mb-2"
            placeholder="Tìm talent theo tên…"
            value={talentQuery}
            onChange={(e) => setTalentQuery(e.target.value)}
          />
          <select className="input" value={pickTalent} onChange={(e) => setPickTalent(e.target.value)}>
            <option value="">— Chọn talent —</option>
            {availableTalents.map((t) => (
              <option key={t.id} value={t.id}>
                {t.ho_ten}
                {t.status === "pending" ? " (chờ duyệt)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={addCasting} disabled={!pickTalent || adding}>
          {adding ? "Đang thêm…" : "+ Thêm"}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">Talent</th>
              <th className="th">Vai</th>
              <th className="th">Kết quả</th>
              <th className="th text-right">Tiền HĐ</th>
              <th className="th">OT</th>
              <th className="th text-right">Chi phí OT</th>
              <th className="th">Ghi chú</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-dark/5 last:border-0">
                <td className="td font-semibold">{r.talent?.ho_ten ?? "—"}</td>
                <td className="td">
                  <input
                    className="input py-1"
                    defaultValue={r.vai ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (r.vai ?? null)) saveField(r.id, { vai: v });
                    }}
                  />
                </td>
                <td className="td">
                  <select
                    className="input py-1"
                    value={r.ket_qua}
                    onChange={(e) => saveField(r.id, { ket_qua: e.target.value as KetQua })}
                  >
                    <option value="Không đậu">Không đậu</option>
                    <option value="Đậu">Đậu</option>
                  </select>
                </td>
                <td className="td">
                  <input
                    type="number"
                    className="input py-1 text-right"
                    defaultValue={r.so_tien_hd}
                    min={0}
                    onBlur={(e) => {
                      const v = Number(e.target.value) || 0;
                      if (v !== r.so_tien_hd) saveField(r.id, { so_tien_hd: v });
                    }}
                  />
                </td>
                <td className="td">
                  <select
                    className="input py-1"
                    value={r.co_ot}
                    onChange={(e) => saveField(r.id, { co_ot: e.target.value as CoOt })}
                  >
                    <option value="Không">Không</option>
                    <option value="Có">Có</option>
                  </select>
                </td>
                <td className="td">
                  <input
                    type="number"
                    className="input py-1 text-right"
                    defaultValue={r.chi_phi_ot}
                    min={0}
                    onBlur={(e) => {
                      const v = Number(e.target.value) || 0;
                      if (v !== r.chi_phi_ot) saveField(r.id, { chi_phi_ot: v });
                    }}
                  />
                </td>
                <td className="td">
                  <input
                    className="input py-1"
                    defaultValue={r.ghi_chu ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (r.ghi_chu ?? null)) saveField(r.id, { ghi_chu: v });
                    }}
                  />
                </td>
                <td className="td whitespace-nowrap text-right">
                  <span className="mr-2 text-xs text-dark/30">
                    {savingRow === r.id ? "…" : ""}
                  </span>
                  <KetQuaBadge ketQua={r.ket_qua} />
                  <button
                    className="ml-2 text-xs text-warning hover:underline"
                    onClick={() => removeCasting(r.id)}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-dark/40" colSpan={8}>
                  Chưa có talent nào trong job này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
