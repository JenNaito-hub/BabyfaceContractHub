"use client";

import { useRef } from "react";
import type { Asset, AssetKind } from "@/lib/video/types";
import { formatBytes } from "./ui";

export function UploadButton({
  onFiles,
  accept,
  busy,
  label = "Tải file lên",
  multiple = true,
}: {
  onFiles: (files: FileList) => void;
  accept: string;
  busy?: boolean;
  label?: string;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? "Đang xử lý…" : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function AssetThumb({ asset }: { asset: Asset }) {
  if (asset.thumb) {
    // Ảnh preview là data URL từ IndexedDB — next/image không xử lý được.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.thumb} alt={asset.name} className="h-full w-full object-cover" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-dark/8 text-2xl">
      {asset.kind === "audio" ? "♪" : asset.kind === "video" ? "▶" : "◧"}
    </div>
  );
}

/** Lưới chọn asset — dùng ở Editor, Showreel, Talent. */
export function AssetGrid({
  assets,
  kinds,
  selected,
  onToggle,
  onDelete,
  emptyText = "Chưa có file nào.",
}: {
  assets: Asset[];
  kinds?: AssetKind[];
  selected?: string[];
  onToggle?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  emptyText?: string;
}) {
  const shown = kinds ? assets.filter((a) => kinds.includes(a.kind)) : assets;

  if (shown.length === 0) {
    return <p className="py-6 text-center text-sm text-dark/50">{emptyText}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shown.map((asset) => {
        const isOn = selected?.includes(asset.id) ?? false;
        const order = selected ? selected.indexOf(asset.id) + 1 : 0;
        return (
          <div
            key={asset.id}
            className={`group relative overflow-hidden rounded-xl border bg-white transition ${
              isOn ? "border-dark ring-2 ring-lime" : "border-dark/12"
            }`}
          >
            <button
              type="button"
              disabled={!onToggle}
              onClick={() => onToggle?.(asset)}
              className="block w-full text-left disabled:cursor-default"
            >
              <div className="aspect-video w-full overflow-hidden bg-dark/5">
                <AssetThumb asset={asset} />
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate text-xs font-semibold" title={asset.name}>
                  {asset.name}
                </p>
                <p className="mt-0.5 text-[11px] text-dark/50">
                  {asset.kind === "image"
                    ? `${asset.width}×${asset.height}`
                    : `${asset.duration.toFixed(1)}s`}{" "}
                  · {formatBytes(asset.size)}
                </p>
              </div>
            </button>

            {isOn && order > 0 && (
              <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-lime text-xs font-extrabold text-dark">
                {order}
              </span>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(asset)}
                aria-label={`Xoá ${asset.name}`}
                className="absolute right-2 top-2 hidden rounded-lg bg-warning px-2 py-1 text-xs font-bold text-white group-hover:block"
              >
                Xoá
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
