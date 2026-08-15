"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatVND, parseSoDo, type RatingAggregate } from "@/lib/calculations";
import { StatusBadge } from "@/components/Badges";
import type { Talent, TalentStatus } from "@/lib/types";
import TalentModal from "@/components/directory/TalentModal";

export type TalentAggregate = { jobIds: Set<string>; tongTien: number };

type AdvancedFilters = {
  gioiTinh: string;
  phanLoai: string;
  caoMin: string;
  caoMax: string;
  nangMin: string;
  nangMax: string;
  diemMin: string;
  daLamJob: "all" | "co" | "chua";
  anBlacklist: boolean;
};

const EMPTY_FILTERS: AdvancedFilters = {
  gioiTinh: "",
  phanLoai: "",
  caoMin: "",
  caoMax: "",
  nangMin: "",
  nangMax: "",
  diemMin: "",
  daLamJob: "all",
  anBlacklist: true,
};

export default function DirectoryClient({
  talents,
  aggregates,
  ratingAggregates,
  isManager,
  currentUserId,
}: {
  talents: Talent[];
  aggregates: Record<string, { soJob: number; tongTien: number }>;
  ratingAggregates: Record<string, RatingAggregate>;
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
  const [showFilters, setShowFilters] = useState(false);
  const [adv, setAdv] = useState<AdvancedFilters>(EMPTY_FILTERS);

  const phanLoaiOptions = useMemo(
    () => Array.from(new Set(talents.map((t) => t.phan_loai).filter(Boolean) as string[])).sort(),
    [talents],
  );
  const gioiTinhOptions = useMemo(
    () => Array.from(new Set(talents.map((t) => t.gioi_tinh).filter(Boolean) as string[])).sort(),
    [talents],
  );

  const advCount = useMemo(() => {
    let n = 0;
    if (adv.gioiTinh) n++;
    if (adv.phanLoai) n++;
    if (adv.caoMin || adv.caoMax) n++;
    if (adv.nangMin || adv.nangMax) n++;
    if (adv.diemMin) n++;
    if (adv.daLamJob !== "all") n++;
    if (!adv.anBlacklist) n++;
    return n;
  }, [adv]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const caoMin = adv.caoMin ? Number(adv.caoMin) : null;
    const caoMax = adv.caoMax ? Number(adv.caoMax) : null;
    const nangMin = adv.nangMin ? Number(adv.nangMin) : null;
    const nangMax = adv.nangMax ? Number(adv.nangMax) : null;
    const diemMin = adv.diemMin ? Number(adv.diemMin) : null;

    return talents.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (adv.anBlacklist && t.is_blacklisted) return false;
      if (adv.gioiTinh && t.gioi_tinh !== adv.gioiTinh) return false;
      if (adv.phanLoai && t.phan_loai !== adv.phanLoai) return false;

      if (caoMin !== null || caoMax !== null) {
        const cao = parseSoDo(t.chieu_cao);
        if (cao === null) return false;
        if (caoMin !== null && cao < caoMin) return false;
        if (caoMax !== null && cao > caoMax) return false;
      }
      if (nangMin !== null || nangMax !== null) {
        const nang = parseSoDo(t.can_nang);
        if (nang === null) return false;
        if (nangMin !== null && nang < nangMin) return false;
        if (nangMax !== null && nang > nangMax) return false;
      }
      if (diemMin !== null) {
        const r = ratingAggregates[t.id];
        if (!r || r.diemTb < diemMin) return false;
      }
      if (adv.daLamJob !== "all") {
        const soJob = aggregates[t.id]?.soJob ?? 0;
        if (adv.daLamJob === "co" && soJob === 0) return false;
        if (adv.daLamJob === "chua" && soJob > 0) return false;
      }

      if (!q) return true;
      return [t.ho_ten, t.phan_loai, t.gioi_tinh, t.instagram, t.facebook]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [talents, query, statusFilter, adv, aggregates, ratingAggregates]);

  async function toggleBlacklist(t: Talent) {
    if (t.is_blacklisted) {
      if (!confirm(`Bỏ blacklist cho "${t.ho_ten}"?`)) return;
      setBusyId(t.id);
      const supabase = createClient();
      const { error } = await supabase
        .from("talents")
        .update({
          is_blacklisted: false,
          ly_do_blacklist: null,
          blacklisted_by: null,
          blacklisted_at: null,
        })
        .eq("id", t.id);
      setBusyId(null);
      if (error) {
        alert("Không bỏ được: " + error.message);
        return;
      }
      router.refresh();
      return;
    }

    const ly_do = prompt(`Lý do đưa "${t.ho_ten}" vào blacklist?`);
    if (ly_do === null) return;
    setBusyId(t.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("talents")
      .update({
        is_blacklisted: true,
        ly_do_blacklist: ly_do.trim() || null,
        blacklisted_by: currentUserId,
        blacklisted_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    setBusyId(null);
    if (error) {
      alert("Không blacklist được: " + error.message);
      return;
    }
    router.refresh();
  }

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
        <button
          className={`btn-ghost ${advCount ? "border-dark/60 font-bold" : ""}`}
          onClick={() => setShowFilters((s) => !s)}
        >
          Lọc nâng cao{advCount ? ` (${advCount})` : ""}
        </button>
        {advCount > 0 && (
          <button className="text-sm text-dark/50 hover:underline" onClick={() => setAdv(EMPTY_FILTERS)}>
            Xoá lọc
          </button>
        )}
        <span className="ml-auto text-sm text-dark/50">{filtered.length} kết quả</span>
      </div>

      {showFilters && (
        <div className="card mb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Giới tính</label>
              <select
                className="input"
                value={adv.gioiTinh}
                onChange={(e) => setAdv((a) => ({ ...a, gioiTinh: e.target.value }))}
              >
                <option value="">Tất cả</option>
                {gioiTinhOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Phân loại</label>
              <select
                className="input"
                value={adv.phanLoai}
                onChange={(e) => setAdv((a) => ({ ...a, phanLoai: e.target.value }))}
              >
                <option value="">Tất cả</option>
                {phanLoaiOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Chiều cao (cm)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input"
                  placeholder="từ"
                  value={adv.caoMin}
                  onChange={(e) => setAdv((a) => ({ ...a, caoMin: e.target.value }))}
                />
                <span className="text-dark/40">–</span>
                <input
                  type="number"
                  className="input"
                  placeholder="đến"
                  value={adv.caoMax}
                  onChange={(e) => setAdv((a) => ({ ...a, caoMax: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Cân nặng (kg)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input"
                  placeholder="từ"
                  value={adv.nangMin}
                  onChange={(e) => setAdv((a) => ({ ...a, nangMin: e.target.value }))}
                />
                <span className="text-dark/40">–</span>
                <input
                  type="number"
                  className="input"
                  placeholder="đến"
                  value={adv.nangMax}
                  onChange={(e) => setAdv((a) => ({ ...a, nangMax: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Điểm đánh giá tối thiểu</label>
              <select
                className="input"
                value={adv.diemMin}
                onChange={(e) => setAdv((a) => ({ ...a, diemMin: e.target.value }))}
              >
                <option value="">Không lọc</option>
                {[3, 3.5, 4, 4.5, 5].map((d) => (
                  <option key={d} value={d}>
                    ≥ {d} ★
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kinh nghiệm</label>
              <select
                className="input"
                value={adv.daLamJob}
                onChange={(e) =>
                  setAdv((a) => ({ ...a, daLamJob: e.target.value as AdvancedFilters["daLamJob"] }))
                }
              >
                <option value="all">Tất cả</option>
                <option value="co">Đã từng casting</option>
                <option value="chua">Chưa casting lần nào</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={adv.anBlacklist}
                  onChange={(e) => setAdv((a) => ({ ...a, anBlacklist: e.target.checked }))}
                />
                Ẩn talent blacklist
              </label>
            </div>
          </div>
          <p className="mt-3 text-xs text-dark/50">
            Chiều cao/cân nặng đọc từ text nhập tự do (170, 1m70, 55kg…). Talent chưa nhập chỉ số sẽ
            không xuất hiện khi lọc theo khoảng.
          </p>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">Họ tên</th>
              <th className="th">Phân loại</th>
              <th className="th">Chỉ số</th>
              {isManager && <th className="th">SĐT</th>}
              <th className="th text-right">Số job</th>
              <th className="th text-right">Tổng nhận</th>
              <th className="th">Đánh giá</th>
              <th className="th">Status</th>
              <th className="th text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const a = aggregates[t.id] ?? { soJob: 0, tongTien: 0 };
              const r = ratingAggregates[t.id];
              return (
                <tr key={t.id} className="border-b border-dark/5 last:border-0 hover:bg-dark/[0.02]">
                  <td className="td font-semibold">
                    <span className={t.is_blacklisted ? "line-through decoration-warning" : ""}>
                      {t.ho_ten}
                    </span>
                    {t.is_blacklisted && (
                      <span
                        className="badge ml-2 bg-warning/15 text-warning"
                        title={t.ly_do_blacklist ?? "Không ghi lý do"}
                      >
                        Blacklist
                      </span>
                    )}
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
                  <td className="td whitespace-nowrap">
                    {r ? (
                      <span title={`${r.soDanhGia} đánh giá`}>
                        <b>{r.diemTb.toFixed(1)}</b> ★
                        <span className="text-xs text-dark/40"> ({r.soDanhGia})</span>
                      </span>
                    ) : (
                      <span className="text-dark/30">—</span>
                    )}
                  </td>
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
                          className="btn-ghost px-2.5 py-1 text-xs"
                          disabled={busyId === t.id}
                          onClick={() => toggleBlacklist(t)}
                        >
                          {t.is_blacklisted ? "Bỏ BL" : "Blacklist"}
                        </button>
                      )}
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
                <td className="td py-10 text-center text-dark/40" colSpan={isManager ? 9 : 8}>
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
