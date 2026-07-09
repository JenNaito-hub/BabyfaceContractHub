"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/calculations";
import { StatusBadge } from "@/components/Badges";
import type { Talent, TalentStatus } from "@/lib/types";
import TalentModal from "@/components/directory/TalentModal";

export type TalentAggregate = { jobIds: Set<string>; tongTien: number };

export default function DirectoryClient({
  talents,
  aggregates,
  isManager,
  currentUserId,
}: {
  talents: Talent[];
  aggregates: Record<string, { soJob: number; tongTien: number }>;
  isManager: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TalentStatus>("all");
  const [editing, setEditing] = useState<Talent | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return talents.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return [t.ho_ten, t.phan_loai, t.gioi_tinh, t.instagram, t.facebook]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [talents, query, statusFilter]);

  async function approve(t: Talent) {
    setBusyId(t.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("talents")
      .update({ status: "approved" })
      .eq("id", t.id);
    setBusyId(null);
    if (error) {
      alert("Không duyệt được: " + error.message);
      return;
    }
    router.refresh();
  }

  async function revealPhone(t: Talent) {
    if (revealed[t.id] !== undefined) {
      // toggle ẩn
      setRevealed((r) => {
        const copy = { ...r };
        delete copy[t.id];
        return copy;
      });
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("talent_contacts")
      .select("sdt")
      .eq("talent_id", t.id)
      .maybeSingle();
    setRevealed((r) => ({ ...r, [t.id]: (data?.sdt as string) ?? null }));
  }

  async function remove(t: Talent) {
    if (!confirm(`Xoá talent "${t.ho_ten}"? Hành động không thể hoàn tác.`)) return;
    setBusyId(t.id);
    const supabase = createClient();
    const { error } = await supabase.from("talents").delete().eq("id", t.id);
    setBusyId(null);
    if (error) {
      alert("Không xoá được: " + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Talent Directory</h1>
          <p className="text-sm text-dark/60">
            {talents.length} talent · {talents.filter((t) => t.status === "approved").length} đã duyệt
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Thêm talent
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Tìm theo tên, phân loại, IG…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex rounded-lg bg-dark/5 p-1 text-sm font-semibold">
          {(["all", "approved", "pending"] as const).map((s) => (
            <button
              key={s}
              className={`rounded-md px-3 py-1.5 ${
                statusFilter === s ? "bg-white shadow-sm" : "text-dark/50"
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tất cả" : s === "approved" ? "Đã duyệt" : "Chờ duyệt"}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">Họ tên</th>
              <th className="th">Phân loại</th>
              <th className="th">Chỉ số</th>
              {isManager && <th className="th">SĐT</th>}
              <th className="th text-right">Số job</th>
              <th className="th text-right">Tổng nhận</th>
              <th className="th">Status</th>
              <th className="th text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const a = aggregates[t.id] ?? { soJob: 0, tongTien: 0 };
              return (
                <tr key={t.id} className="border-b border-dark/5 last:border-0 hover:bg-dark/[0.02]">
                  <td className="td font-semibold">
                    {t.ho_ten}
                    <div className="text-xs font-normal text-dark/40">
                      {[t.instagram, t.facebook].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="td text-dark/70">{t.phan_loai || "—"}</td>
                  <td className="td text-dark/70">
                    {[t.chieu_cao && `${t.chieu_cao}`, t.can_nang && `${t.can_nang}`, t.so_do]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  {isManager && (
                    <td className="td">
                      {revealed[t.id] !== undefined ? (
                        <button
                          className="font-mono text-dark underline decoration-dotted"
                          onClick={() => revealPhone(t)}
                          title="Bấm để ẩn"
                        >
                          {revealed[t.id] || "(trống)"}
                        </button>
                      ) : (
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => revealPhone(t)}>
                          Hiện SĐT
                        </button>
                      )}
                    </td>
                  )}
                  <td className="td text-right tabular-nums">{a.soJob}</td>
                  <td className="td text-right tabular-nums">{formatVND(a.tongTien)}</td>
                  <td className="td">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      {isManager && t.status === "pending" && (
                        <button
                          className="btn-primary px-2.5 py-1 text-xs"
                          disabled={busyId === t.id}
                          onClick={() => approve(t)}
                        >
                          Duyệt
                        </button>
                      )}
                      <button
                        className="btn-ghost px-2.5 py-1 text-xs"
                        onClick={() => setEditing(t)}
                      >
                        Sửa
                      </button>
                      {isManager && (
                        <button
                          className="btn-ghost px-2.5 py-1 text-xs text-warning"
                          disabled={busyId === t.id}
                          onClick={() => remove(t)}
                        >
                          Xoá
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-dark/40" colSpan={isManager ? 8 : 7}>
                  Không có talent nào khớp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <TalentModal
          talent={editing}
          isManager={isManager}
          currentUserId={currentUserId}
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
