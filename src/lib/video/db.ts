"use client";

// Lớp lưu trữ của Video Studio: IndexedDB, không phụ thuộc Supabase.
// 4 store: assets (metadata) · blobs (file thật) · docs (project/talent/production/script).

import type {
  Asset,
  Production,
  Project,
  ScriptDoc,
  VideoTalent,
} from "./types";

const DB_NAME = "babyface-video-studio";
const DB_VERSION = 1;

const STORE_ASSETS = "assets";
const STORE_BLOBS = "blobs";
const STORE_PROJECTS = "projects";
const STORE_TALENTS = "talents";
const STORE_PRODUCTIONS = "productions";
const STORE_SCRIPTS = "scripts";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Trình duyệt không hỗ trợ IndexedDB"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [
        STORE_ASSETS,
        STORE_BLOBS,
        STORE_PROJECTS,
        STORE_TALENTS,
        STORE_PRODUCTIONS,
        STORE_SCRIPTS,
      ]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === STORE_BLOBS ? undefined : "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không mở được IndexedDB"));
  });

  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Lỗi IndexedDB"));
      }),
  );
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------- Assets ----------

export async function putAsset(asset: Asset, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_ASSETS, STORE_BLOBS], "readwrite");
    t.objectStore(STORE_ASSETS).put(asset);
    t.objectStore(STORE_BLOBS).put(blob, asset.id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("Không lưu được file"));
  });
}

export function listAssets(): Promise<Asset[]> {
  return tx<Asset[]>(STORE_ASSETS, "readonly", (s) => s.getAll()).then((rows) =>
    rows.sort((a, b) => b.createdAt - a.createdAt),
  );
}

export function getAsset(id: string): Promise<Asset | undefined> {
  return tx<Asset | undefined>(STORE_ASSETS, "readonly", (s) => s.get(id));
}

export function getBlob(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(STORE_BLOBS, "readonly", (s) => s.get(id));
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_ASSETS, STORE_BLOBS], "readwrite");
    t.objectStore(STORE_ASSETS).delete(id);
    t.objectStore(STORE_BLOBS).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("Không xoá được file"));
  });
}

// ---------- Generic doc stores ----------

function makeStore<T extends { id: string }>(name: string) {
  return {
    list: () => tx<T[]>(name, "readonly", (s) => s.getAll()),
    get: (id: string) => tx<T | undefined>(name, "readonly", (s) => s.get(id)),
    put: (doc: T) => tx<IDBValidKey>(name, "readwrite", (s) => s.put(doc)).then(() => doc),
    remove: (id: string) => tx<undefined>(name, "readwrite", (s) => s.delete(id)).then(() => {}),
  };
}

export const projectStore = makeStore<Project>(STORE_PROJECTS);
export const talentStore = makeStore<VideoTalent>(STORE_TALENTS);
export const productionStore = makeStore<Production>(STORE_PRODUCTIONS);
export const scriptStore = makeStore<ScriptDoc>(STORE_SCRIPTS);

// ---------- Đọc metadata từ file upload ----------

function readVideoMeta(
  url: string,
): Promise<{ duration: number; width: number; height: number; thumb: string }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.onerror = () => reject(new Error("Không đọc được video"));
    v.onloadedmetadata = () => {
      // Nhảy tới 10% để lấy thumbnail có hình (frame 0 hay bị đen).
      const seekTo = Math.min(Math.max(v.duration * 0.1, 0.1), v.duration || 0.1);
      v.currentTime = Number.isFinite(seekTo) ? seekTo : 0;
    };
    v.onseeked = () => {
      resolve({
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth,
        height: v.videoHeight,
        thumb: snapshot(v, v.videoWidth, v.videoHeight),
      });
    };
    v.src = url;
  });
}

function readImageMeta(
  url: string,
): Promise<{ width: number; height: number; thumb: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Không đọc được ảnh"));
    img.onload = () =>
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        thumb: snapshot(img, img.naturalWidth, img.naturalHeight),
      });
    img.src = url;
  });
}

function readAudioMeta(url: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onerror = () => reject(new Error("Không đọc được audio"));
    a.onloadedmetadata = () =>
      resolve({ duration: Number.isFinite(a.duration) ? a.duration : 0 });
    a.src = url;
  });
}

function snapshot(
  source: CanvasImageSource,
  w: number,
  h: number,
  max = 320,
): string {
  if (!w || !h) return "";
  const scale = Math.min(max / w, max / h, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

/** Upload 1 file → đọc metadata → lưu vào IndexedDB → trả Asset. */
export async function importFile(file: File): Promise<Asset> {
  const kind: Asset["kind"] = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("audio/")
      ? "audio"
      : "image";

  const url = URL.createObjectURL(file);
  try {
    let duration = 0;
    let width = 0;
    let height = 0;
    let thumb = "";

    if (kind === "video") {
      const meta = await readVideoMeta(url);
      ({ duration, width, height, thumb } = meta);
    } else if (kind === "image") {
      const meta = await readImageMeta(url);
      ({ width, height, thumb } = meta);
    } else {
      ({ duration } = await readAudioMeta(url));
    }

    const asset: Asset = {
      id: uid("asset"),
      kind,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      duration,
      width,
      height,
      thumb,
      createdAt: Date.now(),
    };
    await putAsset(asset, file);
    return asset;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ước lượng dung lượng đã dùng (nếu trình duyệt hỗ trợ). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}
