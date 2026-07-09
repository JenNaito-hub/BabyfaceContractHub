"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Talent } from "@/lib/types";

export default function ApprovalsClient({ pending }: { pending: Talent[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(t: Talent) {
    setBusy(t.id);
    const supabase = createClient();
    const { error } = await supabase.from("talents").update({ status: "approved" }).eq("id", t.id);
    setBusy(null);
    if (error) {
      alert("Không duyệt được: " + error.message);
      return;
    }
    router.refresh();
  }

  async function reject(t: Talent) {
    if (!confirm(`Từ chối & xoá hồ sơ "${t.ho_ten}"?`)) return;
    setBusy(t.id);
    const supabase = createClient();
    const { error } = await supabase.from("talents").delete().eq("id", t.id);
    setBusy(null);
    if (error) {
      alert("Không xoá được: " + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">Duyệt talent</h1>
        <p className="text-sm text-dark/60">{pending.length} hồ sơ đang chờ duyệt</p>
      </div>

      {pending.length === 0 ? (
        <div className="card text-center text-dark/40">Không có hồ sơ chờ duyệt. 🎉</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((t) => (
            <div key={t.id} className="card flex flex-col">
              <div className="font-semibold">{t.ho_ten}</div>
              <div className="mt-1 space-y-0.5 text-sm text-dark/60">
                {t.phan_loai && <div>Phân loại: {t.phan_loai}</div>}
                {t.gioi_tinh && <div>Giới tính: {t.gioi_tinh}</div>}
                {(t.chieu_cao || t.can_nang || t.so_do) && (
                  <div>
                    {[t.chieu_cao, t.can_nang, t.so_do].filter(Boolean).join(" · ")}
                  </div>
                )}
                {(t.instagram || t.facebook) && (
                  <div className="text-dark/40">
                    {[t.instagram, t.facebook].filter(Boolean).join(" · ")}
                  </div>
                )}
                {t.ghi_chu && <div className="italic">{t.ghi_chu}</div>}
              </div>
              <div className="mt-4 flex gap-2 border-t border-dark/5 pt-3">
                <button
                  className="btn-primary flex-1"
                  disabled={busy === t.id}
                  onClick={() => approve(t)}
                >
                  Duyệt
                </button>
                <button
                  className="btn-ghost text-warning"
                  disabled={busy === t.id}
                  onClick={() => reject(t)}
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
