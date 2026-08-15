"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import { DE_XUAT, type CastingWithTalent, type DeXuat, type Job, type TalentRating } from "@/lib/types";

export default function RatingModal({
  casting,
  job,
  existing,
  currentUserId,
  onClose,
  onSaved,
}: {
  casting: CastingWithTalent;
  job: Job;
  existing: TalentRating | null;
  currentUserId: string | null;
  onClose: () => void;
  onSaved: (rating: TalentRating) => void;
}) {
  const [diem, setDiem] = useState<number>(existing?.diem ?? 5);
  const [deXuat, setDeXuat] = useState<DeXuat>(existing?.de_xuat ?? "Nên dùng lại");
  const [ghiChu, setGhiChu] = useState(existing?.ghi_chu ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // 1 casting chỉ có 1 đánh giá (unique casting_id) — upsert để sửa lại được.
    const { data, error } = await supabase
      .from("talent_ratings")
      .upsert(
        {
          casting_id: casting.id,
          talent_id: casting.talent_id,
          job_id: job.id,
          diem,
          de_xuat: deXuat,
          ghi_chu: ghiChu.trim() || null,
          created_by: currentUserId,
        },
        { onConflict: "casting_id" },
      )
      .select("*")
      .single();

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved(data as TalentRating);
  }

  return (
    <Modal
      title={`Đánh giá: ${casting.talent?.ho_ten ?? "talent"}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn-primary" form="rating-form" type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu đánh giá"}
          </button>
        </>
      }
    >
      <form id="rating-form" onSubmit={save} className="space-y-4">
        <p className="text-sm text-dark/60">
          Job <b>{job.ten_job}</b>
          {casting.vai ? ` · vai ${casting.vai}` : ""}
        </p>

        <div>
          <label className="label">Điểm</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDiem(n)}
                className={`h-10 w-10 rounded-lg text-lg font-bold transition ${
                  n <= diem ? "bg-lime text-dark" : "bg-dark/5 text-dark/30"
                }`}
                aria-label={`${n} sao`}
              >
                ★
              </button>
            ))}
            <span className="ml-2 self-center text-sm text-dark/60">{diem}/5</span>
          </div>
        </div>

        <div>
          <label className="label">Đề xuất</label>
          <select
            className="input"
            value={deXuat}
            onChange={(e) => setDeXuat(e.target.value as DeXuat)}
          >
            {DE_XUAT.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Nhận xét</label>
          <textarea
            className="input"
            rows={3}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="Đúng giờ, hợp tác tốt, cần nhắc trước lịch…"
          />
        </div>

        {error && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p>}
      </form>
    </Modal>
  );
}
