"use client";

import { useEffect, useMemo, useState } from "react";
import { talentStore, uid } from "@/lib/video/db";
import { useAssets } from "@/lib/video/hooks";
import type { VideoTalent } from "@/lib/video/types";
import { AssetGrid, AssetThumb, UploadButton } from "./MediaPicker";
import { Empty, Field, PageHead, useToast } from "./ui";

function blankTalent(): VideoTalent {
  return {
    id: uid("tal"),
    name: "",
    role: "",
    note: "",
    tags: [],
    mediaIds: [],
    createdAt: Date.now(),
  };
}

export default function TalentClient() {
  const { assets, busy, upload } = useAssets();
  const [talents, setTalents] = useState<VideoTalent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VideoTalent | null>(null);
  const [query, setQuery] = useState("");
  const toast = useToast();

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const reload = async () => {
    setTalents((await talentStore.list()).sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Cần nhập tên talent");
      return;
    }
    await talentStore.put({ ...editing, name: editing.name.trim() });
    setEditing(null);
    await reload();
    toast.show("Đã lưu talent");
  };

  const remove = async (t: VideoTalent) => {
    if (!confirm(`Xoá "${t.name}" khỏi hồ sơ video? File media vẫn còn trong Thư viện.`)) return;
    await talentStore.remove(t.id);
    await reload();
    toast.show("Đã xoá talent");
  };

  const filtered = talents.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.role.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <PageHead
        title="Hồ sơ talent (Video Studio)"
        desc="Hồ sơ riêng của app dựng video: tên, vai, ảnh/clip. Tách hoàn toàn khỏi khu /talent — không có số điện thoại hay dữ liệu nhạy cảm ở đây."
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing(blankTalent())}>
            + Thêm talent
          </button>
        }
      />

      {talents.length > 0 && (
        <input
          className="input mb-4 max-w-sm"
          placeholder="Tìm theo tên, vai, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-dark/50">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <Empty
          title={talents.length === 0 ? "Chưa có talent nào" : "Không khớp tìm kiếm"}
          desc={
            talents.length === 0
              ? "Thêm talent kèm ảnh/clip để dựng showreel tự động chỉ bằng vài cú bấm."
              : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="card">
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-dark/8">
                  {t.mediaIds[0] && assetMap.get(t.mediaIds[0]) ? (
                    <AssetThumb asset={assetMap.get(t.mediaIds[0])!} />
                  ) : (
                    <div className="grid h-full place-items-center text-xl text-dark/30">◧</div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-bold">{t.name}</h3>
                  <p className="truncate text-sm text-dark/55">{t.role || "—"}</p>
                  <p className="text-xs text-dark/45">{t.mediaIds.length} file</p>
                </div>
              </div>

              {t.note && <p className="mt-2 line-clamp-2 text-xs text-dark/55">{t.note}</p>}

              {t.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span key={tag} className="badge bg-dark/8 text-dark/70">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-ghost flex-1" onClick={() => setEditing(t)}>
                  Sửa
                </button>
                <button type="button" className="btn-ghost" onClick={() => void remove(t)}>
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-dark/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 font-display text-lg font-extrabold">
              {talents.some((t) => t.id === editing.id) ? "Sửa talent" : "Thêm talent"}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên">
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Vai / hạng mục">
                <input
                  className="input"
                  placeholder="VD: Nam chính, KOL, mẫu ảnh"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Ghi chú" hint="Hiện thành dòng phụ trên showreel">
                <input
                  className="input"
                  placeholder="VD: 1m72 · 22 tuổi"
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                />
              </Field>
              <Field label="Tag" hint="Cách nhau bằng dấu phẩy">
                <input
                  className="input"
                  placeholder="thương mại, thời trang"
                  value={editing.tags.join(", ")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      tags: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">
                  Ảnh / clip ({editing.mediaIds.length} đã chọn — bấm để chọn theo thứ tự)
                </span>
                <UploadButton
                  accept="video/*,image/*"
                  busy={busy}
                  label="Tải lên"
                  onFiles={async (files) => {
                    const added = await upload(files);
                    setEditing((cur) =>
                      cur ? { ...cur, mediaIds: [...cur.mediaIds, ...added.map((a) => a.id)] } : cur,
                    );
                  }}
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-dark/10 p-2">
                <AssetGrid
                  assets={assets}
                  kinds={["video", "image"]}
                  selected={editing.mediaIds}
                  onToggle={(a) =>
                    setEditing((cur) => {
                      if (!cur) return cur;
                      const has = cur.mediaIds.includes(a.id);
                      return {
                        ...cur,
                        mediaIds: has
                          ? cur.mediaIds.filter((id) => id !== a.id)
                          : [...cur.mediaIds, a.id],
                      };
                    })
                  }
                  emptyText="Chưa có ảnh/clip. Bấm “Tải lên” để thêm."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                Huỷ
              </button>
              <button type="button" className="btn-primary" onClick={() => void save()}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.node}
    </>
  );
}
