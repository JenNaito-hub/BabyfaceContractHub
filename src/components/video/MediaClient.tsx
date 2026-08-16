"use client";

import { useEffect, useState } from "react";
import { deleteAsset, storageEstimate } from "@/lib/video/db";
import { useAssets } from "@/lib/video/hooks";
import type { Asset, AssetKind } from "@/lib/video/types";
import { AssetGrid, UploadButton } from "./MediaPicker";
import { Empty, PageHead, formatBytes, useToast } from "./ui";

const FILTERS: { id: AssetKind | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "video", label: "Video" },
  { id: "image", label: "Ảnh" },
  { id: "audio", label: "Nhạc" },
];

export default function MediaClient() {
  const { assets, loading, busy, error, reload, upload } = useAssets();
  const [filter, setFilter] = useState<AssetKind | "all">("all");
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const toast = useToast();

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, [assets.length]);

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Xoá "${asset.name}"? Các project đang dùng file này sẽ thiếu clip.`)) return;
    await deleteAsset(asset.id);
    await reload();
    toast.show("Đã xoá file");
  };

  const counts = {
    video: assets.filter((a) => a.kind === "video").length,
    image: assets.filter((a) => a.kind === "image").length,
    audio: assets.filter((a) => a.kind === "audio").length,
  };

  return (
    <>
      <PageHead
        title="Thư viện media"
        desc="Video, ảnh và nhạc nền dùng cho Editor và Showreel. File lưu trong trình duyệt (IndexedDB), không upload lên server."
        action={
          <UploadButton
            accept="video/*,image/*,audio/*"
            busy={busy}
            onFiles={async (files) => {
              const added = await upload(files);
              if (added.length) toast.show(`Đã thêm ${added.length} file`);
            }}
          />
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="card py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">Video</p>
          <p className="font-display text-xl font-extrabold">{counts.video}</p>
        </div>
        <div className="card py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">Ảnh</p>
          <p className="font-display text-xl font-extrabold">{counts.image}</p>
        </div>
        <div className="card py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">Nhạc</p>
          <p className="font-display text-xl font-extrabold">{counts.audio}</p>
        </div>
        <div className="card py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">Dung lượng</p>
          <p className="font-display text-xl font-extrabold">
            {usage ? formatBytes(usage.usage) : "—"}
          </p>
          {usage && usage.quota > 0 && (
            <p className="text-[11px] text-dark/45">còn ~{formatBytes(usage.quota - usage.usage)}</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              filter === f.id ? "bg-dark text-paper" : "bg-white text-dark/70 hover:bg-dark/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-dark/50">Đang tải thư viện…</p>
      ) : assets.length === 0 ? (
        <Empty
          title="Thư viện đang trống"
          desc="Tải video, ảnh talent và nhạc nền lên để bắt đầu dựng. Mọi thứ nằm trên máy bạn."
        />
      ) : (
        <AssetGrid
          assets={assets}
          kinds={filter === "all" ? undefined : [filter]}
          onDelete={handleDelete}
        />
      )}

      {toast.node}
    </>
  );
}
