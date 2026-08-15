"use client";

// Sao lưu / khôi phục toàn bộ Video Studio.
// Dữ liệu nằm trong IndexedDB nên xoá cache trình duyệt là mất — file .zip này
// là cách duy nhất giữ lại và chuyển sang máy khác.

import {
  getBlob,
  listAssets,
  productionStore,
  projectStore,
  putAsset,
  scriptStore,
  talentStore,
} from "./db";
import type {
  Asset,
  Production,
  Project,
  ScriptDoc,
  VideoTalent,
} from "./types";
import { unzip, zipSync, type ZipEntry } from "./zip";

export const BACKUP_VERSION = 1;
const MEDIA_DIR = "media/";

export type BackupData = {
  version: number;
  exportedAt: string;
  app: string;
  assets: Asset[];
  projects: Project[];
  talents: VideoTalent[];
  productions: Production[];
  scripts: ScriptDoc[];
};

export type BackupSummary = {
  assets: number;
  projects: number;
  talents: number;
  productions: number;
  scripts: number;
  mediaBytes: number;
};

export type RestoreMode = "merge" | "replace";

function extensionOf(asset: Asset): string {
  const fromName = asset.name.includes(".") ? asset.name.split(".").pop() : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const sub = asset.mime.split("/")[1] ?? "bin";
  return sub.split(";")[0];
}

/** Đọc hết dữ liệu hiện có (không kèm blob). */
async function collect(): Promise<BackupData> {
  const [assets, projects, talents, productions, scripts] = await Promise.all([
    listAssets(),
    projectStore.list(),
    talentStore.list(),
    productionStore.list(),
    scriptStore.list(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "babyface-video-studio",
    assets,
    projects,
    talents,
    productions,
    scripts,
  };
}

export async function currentSummary(): Promise<BackupSummary> {
  const data = await collect();
  return {
    assets: data.assets.length,
    projects: data.projects.length,
    talents: data.talents.length,
    productions: data.productions.length,
    scripts: data.scripts.length,
    mediaBytes: data.assets.reduce((s, a) => s + a.size, 0),
  };
}

/**
 * Tạo file sao lưu.
 * `includeMedia` = false → chỉ có dự án/talent/kịch bản (file rất nhẹ, nhưng
 * mở lại sẽ thiếu hình vì không có media).
 */
export async function createBackup(
  includeMedia: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const data = await collect();
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];

  if (includeMedia) {
    const total = data.assets.length;
    let done = 0;
    for (const asset of data.assets) {
      const blob = await getBlob(asset.id);
      if (blob) {
        entries.push({
          name: `${MEDIA_DIR}${asset.id}.${extensionOf(asset)}`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      onProgress?.(++done, total);
    }
  }

  // data.json để cuối: giải nén xong là có ngay danh mục.
  entries.push({
    name: "data.json",
    data: encoder.encode(JSON.stringify({ ...data, hasMedia: includeMedia }, null, 2)),
  });
  entries.push({
    name: "README.txt",
    data: encoder.encode(
      [
        "Bản sao lưu Babyface Video Studio",
        `Tạo lúc: ${data.exportedAt}`,
        `Kèm media: ${includeMedia ? "có" : "không"}`,
        "",
        "Khôi phục: mở app → /video/backup → chọn file .zip này.",
        "Đừng sửa tay data.json trừ khi biết rõ đang làm gì.",
      ].join("\n"),
    ),
  });

  return zipSync(entries);
}

export type RestoreResult = BackupSummary & { mode: RestoreMode; hadMedia: boolean };

/** Đọc file .zip và ghi lại vào IndexedDB. */
export async function restoreBackup(
  file: Blob,
  mode: RestoreMode,
  onProgress?: (done: number, total: number) => void,
): Promise<RestoreResult> {
  const files = await unzip(file);

  const raw = files.get("data.json");
  if (!raw) throw new Error("File sao lưu thiếu data.json");

  let data: BackupData & { hasMedia?: boolean };
  try {
    data = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("data.json trong file sao lưu bị hỏng");
  }
  if (data.app !== "babyface-video-studio") {
    throw new Error("Không phải bản sao lưu của Video Studio");
  }
  if (data.version > BACKUP_VERSION) {
    throw new Error(
      `Bản sao lưu tạo bởi phiên bản mới hơn (v${data.version}). Cập nhật app rồi thử lại.`,
    );
  }

  if (mode === "replace") await wipeAll();

  // Media trước, để project khôi phục xong là có hình ngay.
  const mediaByAsset = new Map<string, Uint8Array>();
  files.forEach((bytes, name) => {
    if (!name.startsWith(MEDIA_DIR)) return;
    const base = name.slice(MEDIA_DIR.length);
    mediaByAsset.set(base.split(".")[0], bytes);
  });

  const total = (data.assets?.length ?? 0) + (data.projects?.length ?? 0);
  let done = 0;

  for (const asset of data.assets ?? []) {
    const bytes = mediaByAsset.get(asset.id);
    if (bytes) {
      // Copy sang ArrayBuffer riêng: subarray đang trỏ vào buffer chung của cả zip.
      await putAsset(asset, new Blob([bytes.slice()], { type: asset.mime }));
    }
    onProgress?.(++done, total);
  }

  for (const project of data.projects ?? []) {
    await projectStore.put(project);
    onProgress?.(++done, total);
  }
  for (const t of data.talents ?? []) await talentStore.put(t);
  for (const p of data.productions ?? []) await productionStore.put(p);
  for (const s of data.scripts ?? []) await scriptStore.put(s);

  return {
    mode,
    hadMedia: mediaByAsset.size > 0,
    assets: mediaByAsset.size,
    projects: data.projects?.length ?? 0,
    talents: data.talents?.length ?? 0,
    productions: data.productions?.length ?? 0,
    scripts: data.scripts?.length ?? 0,
    mediaBytes: (data.assets ?? []).reduce((s, a) => s + a.size, 0),
  };
}

/** Xoá sạch dữ liệu Video Studio (dùng cho chế độ thay thế, hoặc reset tay). */
export async function wipeAll(): Promise<void> {
  const { deleteAsset } = await import("./db");
  const [assets, projects, talents, productions, scripts] = await Promise.all([
    listAssets(),
    projectStore.list(),
    talentStore.list(),
    productionStore.list(),
    scriptStore.list(),
  ]);
  for (const a of assets) await deleteAsset(a.id);
  for (const p of projects) await projectStore.remove(p.id);
  for (const t of talents) await talentStore.remove(t.id);
  for (const p of productions) await productionStore.remove(p.id);
  for (const s of scripts) await scriptStore.remove(s.id);
}
