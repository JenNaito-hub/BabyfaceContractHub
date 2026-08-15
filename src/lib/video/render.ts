"use client";

// Engine dựng video chạy hoàn toàn trong trình duyệt:
//  - MediaPool: nạp asset từ IndexedDB ra <video>/<img>/<audio>
//  - drawFrame: vẽ 1 khung hình của timeline lên canvas
//  - Player: phát preview (requestAnimationFrame)
//  - exportProject: quay canvas + trộn audio bằng MediaRecorder → file video thật

import { getAsset, getBlob } from "./db";
import type { Asset, Caption, Clip, Project } from "./types";

/** Thời lượng hiệu ứng chuyển cảnh (giây). */
export const TRANSITION_SEC = 0.6;

export function clipStart(project: Project, index: number): number {
  let t = 0;
  for (let i = 0; i < index; i++) t += project.clips[i].duration;
  return t;
}

export function totalDuration(project: Project): number {
  return project.clips.reduce((sum, c) => sum + c.duration, 0);
}

/** Trả về clip đang chạy tại thời điểm t và thời gian cục bộ trong clip đó. */
export function clipAt(
  project: Project,
  t: number,
): { index: number; local: number } | null {
  let acc = 0;
  for (let i = 0; i < project.clips.length; i++) {
    const d = project.clips[i].duration;
    if (t < acc + d || i === project.clips.length - 1) {
      return { index: i, local: Math.max(0, Math.min(t - acc, d)) };
    }
    acc += d;
  }
  return null;
}

// ---------------------------------------------------------------- MediaPool

export class MediaPool {
  private urls = new Map<string, string>();
  private assets = new Map<string, Asset>();
  private videos = new Map<string, HTMLVideoElement>();
  private images = new Map<string, HTMLImageElement>();
  private audios = new Map<string, HTMLAudioElement>();

  async load(assetId: string): Promise<void> {
    if (this.urls.has(assetId)) return;

    const [asset, blob] = await Promise.all([getAsset(assetId), getBlob(assetId)]);
    if (!asset || !blob) throw new Error(`Thiếu file cho asset ${assetId}`);

    const url = URL.createObjectURL(blob);
    this.urls.set(assetId, url);
    this.assets.set(assetId, asset);

    if (asset.kind === "video") {
      const v = document.createElement("video");
      v.src = url;
      v.preload = "auto";
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error(`Không nạp được video ${asset.name}`));
      });
      this.videos.set(assetId, v);
    } else if (asset.kind === "image") {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Không nạp được ảnh ${asset.name}`));
      });
      this.images.set(assetId, img);
    } else {
      const a = document.createElement("audio");
      a.src = url;
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        a.onloadeddata = () => resolve();
        a.onerror = () => reject(new Error(`Không nạp được audio ${asset.name}`));
      });
      this.audios.set(assetId, a);
    }
  }

  async loadProject(project: Project): Promise<void> {
    const ids = new Set<string>();
    project.clips.forEach((c) => ids.add(c.assetId));
    if (project.music) ids.add(project.music.assetId);
    if (project.watermark) ids.add(project.watermark.assetId);
    for (const id of ids) await this.load(id);
  }

  asset(id: string) {
    return this.assets.get(id);
  }
  video(id: string) {
    return this.videos.get(id);
  }
  image(id: string) {
    return this.images.get(id);
  }
  audio(id: string) {
    return this.audios.get(id);
  }
  url(id: string) {
    return this.urls.get(id);
  }

  /** Nguồn vẽ được cho canvas (video hoặc ảnh). */
  drawable(id: string): HTMLVideoElement | HTMLImageElement | null {
    return this.videos.get(id) ?? this.images.get(id) ?? null;
  }

  dispose(): void {
    this.videos.forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
    this.audios.forEach((a) => {
      a.pause();
      a.removeAttribute("src");
      a.load();
    });
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls.clear();
    this.assets.clear();
    this.videos.clear();
    this.images.clear();
    this.audios.clear();
  }
}

// ---------------------------------------------------------------- Vẽ khung

function drawSource(
  ctx: CanvasRenderingContext2D,
  src: HTMLVideoElement | HTMLImageElement,
  W: number,
  H: number,
  fit: Clip["fit"],
  zoom: number,
  offsetX: number,
) {
  const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
  const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
  if (!sw || !sh) return;

  const base = fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const scale = base * zoom;
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, offsetX + (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxWidth) {
        out.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  cap: Caption,
  W: number,
  H: number,
  local: number,
  clipDuration: number,
  alpha: number,
  offsetX: number,
) {
  const end = cap.hold > 0 ? cap.delay + cap.hold : clipDuration;
  if (local < cap.delay || local > end) return;

  // Fade chữ vào/ra trong 0.25s.
  const fadeIn = Math.min(1, (local - cap.delay) / 0.25);
  const fadeOut = Math.min(1, (end - local) / 0.25);
  const a = alpha * Math.max(0, Math.min(fadeIn, fadeOut));
  if (a <= 0) return;

  const size = (cap.size / 100) * H;
  const subSize = size * 0.55;
  const pad = size * 0.4;
  const maxWidth = W * 0.82;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `700 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textBaseline = "top";

  const lines = wrapLines(ctx, cap.text, maxWidth);

  let subLines: string[] = [];
  if (cap.sub) {
    ctx.font = `500 ${subSize}px system-ui, sans-serif`;
    subLines = wrapLines(ctx, cap.sub, maxWidth);
    ctx.font = `700 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  }

  const lineH = size * 1.2;
  const subLineH = subSize * 1.3;
  const blockH = lines.length * lineH + (subLines.length ? subLines.length * subLineH + size * 0.25 : 0);

  let blockW = 0;
  lines.forEach((l) => (blockW = Math.max(blockW, ctx.measureText(l).width)));
  if (subLines.length) {
    ctx.font = `500 ${subSize}px system-ui, sans-serif`;
    subLines.forEach((l) => (blockW = Math.max(blockW, ctx.measureText(l).width)));
    ctx.font = `700 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  }

  const cx = offsetX + (cap.x / 100) * W;
  const top = (cap.y / 100) * H - blockH / 2;
  let left = cx - blockW / 2;
  if (cap.align === "left") left = cx;
  if (cap.align === "right") left = cx - blockW;

  if (cap.background) {
    ctx.fillStyle = cap.background;
    const r = pad * 0.6;
    const bx = left - pad;
    const by = top - pad * 0.6;
    const bw = blockW + pad * 2;
    const bh = blockH + pad * 1.2;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
    ctx.fill();
  } else {
    // Không có nền → thêm đổ bóng cho chữ luôn đọc được.
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.05;
  }

  ctx.fillStyle = cap.color;
  ctx.textAlign = cap.align === "center" ? "center" : cap.align;
  const anchorX = cap.align === "center" ? left + blockW / 2 : cap.align === "right" ? left + blockW : left;

  let y = top;
  lines.forEach((line) => {
    ctx.fillText(line, anchorX, y);
    y += lineH;
  });

  if (subLines.length) {
    y += size * 0.25;
    ctx.font = `500 ${subSize}px system-ui, sans-serif`;
    ctx.globalAlpha = a * 0.85;
    subLines.forEach((line) => {
      ctx.fillText(line, anchorX, y);
      y += subLineH;
    });
  }

  ctx.restore();
}

function drawOneClip(
  ctx: CanvasRenderingContext2D,
  project: Project,
  pool: MediaPool,
  index: number,
  local: number,
  alpha: number,
  offsetX: number,
) {
  const clip = project.clips[index];
  if (!clip) return;
  const src = pool.drawable(clip.assetId);
  if (!src) return;

  const W = project.width;
  const H = project.height;
  const progress = clip.duration > 0 ? Math.max(0, Math.min(1, local / clip.duration)) : 0;
  const zoom = 1 + (clip.zoom - 1) * progress;

  ctx.save();
  ctx.globalAlpha = alpha;
  drawSource(ctx, src, W, H, clip.fit, zoom, offsetX);
  ctx.restore();

  if (clip.caption) {
    drawCaption(ctx, clip.caption, W, H, local, clip.duration, alpha, offsetX);
  }
}

/** Vẽ toàn bộ khung hình của timeline tại thời điểm t. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  pool: MediaPool,
  t: number,
): void {
  const W = project.width;
  const H = project.height;

  ctx.save();
  ctx.fillStyle = project.background || "#000000";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const at = clipAt(project, t);
  if (at) {
    const { index, local } = at;
    const clip = project.clips[index];
    const prev = index > 0 ? project.clips[index - 1] : null;
    const inTransition = prev && clip.transition !== "none" && local < TRANSITION_SEC;

    if (inTransition && prev) {
      const k = local / TRANSITION_SEC;
      // Vị trí gần cuối của clip trước — đủ chính xác cho crossfade.
      const prevLocal = Math.max(0, prev.duration - (TRANSITION_SEC - local));
      if (clip.transition === "slide") {
        drawOneClip(ctx, project, pool, index - 1, prevLocal, 1, -k * W);
        drawOneClip(ctx, project, pool, index, local, 1, (1 - k) * W);
      } else {
        drawOneClip(ctx, project, pool, index - 1, prevLocal, 1, 0);
        drawOneClip(ctx, project, pool, index, local, k, 0);
      }
    } else {
      drawOneClip(ctx, project, pool, index, local, 1, 0);
    }
  }

  const wm = project.watermark;
  if (wm) {
    const img = pool.image(wm.assetId);
    if (img && img.naturalWidth) {
      const w = (wm.scale / 100) * W;
      const h = (w / img.naturalWidth) * img.naturalHeight;
      ctx.save();
      ctx.globalAlpha = wm.opacity;
      ctx.drawImage(img, (wm.x / 100) * W - w / 2, (wm.y / 100) * H - h / 2, w, h);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- Audio

/** Trộn tiếng nhạc nền + tiếng gốc của clip vào 1 stream để ghi. */
class AudioMixer {
  readonly ctx: AudioContext;
  readonly dest: MediaStreamAudioDestinationNode;
  private nodes = new Map<HTMLMediaElement, GainNode>();

  constructor() {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.dest = this.ctx.createMediaStreamDestination();
  }

  /** Mỗi element chỉ được createMediaElementSource 1 lần — cache lại. */
  gainFor(el: HTMLMediaElement): GainNode {
    const existing = this.nodes.get(el);
    if (existing) return existing;
    const source = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    source.connect(gain);
    gain.connect(this.ctx.destination); // để người dùng vẫn nghe
    gain.connect(this.dest); // để MediaRecorder ghi được
    this.nodes.set(el, gain);
    return gain;
  }

  setVolume(el: HTMLMediaElement, v: number) {
    this.gainFor(el).gain.value = Math.max(0, v);
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  close() {
    void this.ctx.close();
    this.nodes.clear();
  }
}

// ---------------------------------------------------------------- Player

export type PlayerOptions = {
  project: Project;
  pool: MediaPool;
  canvas: HTMLCanvasElement;
  onTime?: (t: number) => void;
  onEnd?: () => void;
};

/**
 * Phát timeline: đồng bộ các <video> theo đồng hồ timeline, vẽ từng frame.
 * Dùng chung cho preview và export (export chỉ thêm MediaRecorder).
 */
export class Player {
  private project: Project;
  private pool: MediaPool;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private startWall = 0;
  private startTime = 0;
  private mixer: AudioMixer | null = null;
  private onTime?: (t: number) => void;
  private onEnd?: () => void;

  playing = false;
  time = 0;

  setCallbacks(onTime?: (t: number) => void, onEnd?: () => void): void {
    this.onTime = onTime;
    this.onEnd = onEnd;
  }

  constructor(opts: PlayerOptions) {
    this.project = opts.project;
    this.pool = opts.pool;
    this.canvas = opts.canvas;
    opts.canvas.width = opts.project.width;
    opts.canvas.height = opts.project.height;
    const ctx = opts.canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ canvas 2D");
    this.ctx = ctx;
    this.onTime = opts.onTime;
    this.onEnd = opts.onEnd;
  }

  /**
   * Cập nhật project mà không dựng lại Player — giữ nguyên AudioContext.
   * Trình duyệt giới hạn số AudioContext nên không được tạo mới mỗi lần sửa.
   */
  updateProject(project: Project): void {
    const resized =
      this.canvas.width !== project.width || this.canvas.height !== project.height;
    this.project = project;
    if (resized) {
      this.canvas.width = project.width;
      this.canvas.height = project.height;
    }
    this.time = Math.min(this.time, this.duration);
    if (!this.playing) this.render();
  }

  get duration(): number {
    return totalDuration(this.project);
  }

  /** Chỉ tạo AudioContext khi thực sự cần (phải sau thao tác của người dùng). */
  private ensureMixer(): AudioMixer {
    if (!this.mixer) this.mixer = new AudioMixer();
    return this.mixer;
  }

  audioStream(): MediaStream | null {
    const hasAudio =
      !!this.project.music ||
      this.project.clips.some((c) => {
        if (c.muted) return false;
        const a = this.pool.asset(c.assetId);
        return a?.kind === "video";
      });
    if (!hasAudio) return null;
    return this.ensureMixer().dest.stream;
  }

  /** Ép các phần tử media về đúng vị trí ứng với thời điểm t (dùng khi seek/pause). */
  async seek(t: number): Promise<void> {
    this.time = Math.max(0, Math.min(t, this.duration));
    this.pauseAllMedia();

    const at = clipAt(this.project, this.time);
    if (at) {
      const clip = this.project.clips[at.index];
      const v = this.pool.video(clip.assetId);
      if (v) {
        const target = clip.trimStart + at.local;
        await seekElement(v, target);
      }
      // Clip trước cần sẵn sàng cho crossfade.
      if (at.index > 0 && at.local < TRANSITION_SEC) {
        const prev = this.project.clips[at.index - 1];
        const pv = this.pool.video(prev.assetId);
        if (pv) await seekElement(pv, prev.trimStart + prev.duration);
      }
    }

    const music = this.project.music ? this.pool.audio(this.project.music.assetId) : null;
    if (music) music.currentTime = Math.min(this.time, music.duration || this.time);

    this.render();
    this.onTime?.(this.time);
  }

  render(): void {
    drawFrame(this.ctx, this.project, this.pool, this.time);
  }

  async play(): Promise<void> {
    if (this.playing) return;
    if (this.time >= this.duration - 0.01) await this.seek(0);

    const mixer = this.ensureMixer();
    await mixer.resume();

    this.playing = true;
    this.startWall = performance.now();
    this.startTime = this.time;

    const music = this.project.music ? this.pool.audio(this.project.music.assetId) : null;
    if (music && this.project.music) {
      mixer.setVolume(music, this.project.music.volume);
      music.currentTime = Math.min(this.time, music.duration || 0);
      await music.play().catch(() => {});
    }

    this.tick();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.pauseAllMedia();
  }

  private pauseAllMedia(): void {
    this.project.clips.forEach((c) => {
      const v = this.pool.video(c.assetId);
      if (v && !v.paused) v.pause();
    });
    if (this.project.music) {
      const m = this.pool.audio(this.project.music.assetId);
      if (m && !m.paused) m.pause();
    }
  }

  private tick = (): void => {
    if (!this.playing) return;

    const t = this.startTime + (performance.now() - this.startWall) / 1000;
    this.time = t;

    if (t >= this.duration) {
      this.time = this.duration;
      this.render();
      this.onTime?.(this.time);
      this.playing = false;
      this.pauseAllMedia();
      this.onEnd?.();
      return;
    }

    this.syncMedia(t);
    this.render();
    this.onTime?.(t);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Cho video của clip đang chạy phát đúng đoạn; các video khác dừng lại. */
  private syncMedia(t: number): void {
    const at = clipAt(this.project, t);
    if (!at) return;
    const mixer = this.ensureMixer();

    const activeIds = new Set<string>();
    const activate = (index: number, local: number) => {
      const clip = this.project.clips[index];
      if (!clip) return;
      activeIds.add(clip.assetId);
      const v = this.pool.video(clip.assetId);
      if (!v) return;

      mixer.setVolume(v, clip.muted ? 0 : clip.volume);
      const target = clip.trimStart + local;
      if (Math.abs(v.currentTime - target) > 0.25) v.currentTime = target;
      if (v.paused) void v.play().catch(() => {});
    };

    activate(at.index, at.local);
    // Giữ clip trước chạy trong lúc chuyển cảnh.
    if (at.index > 0 && at.local < TRANSITION_SEC) {
      const prev = this.project.clips[at.index - 1];
      activate(at.index - 1, Math.max(0, prev.duration - (TRANSITION_SEC - at.local)));
    }

    this.project.clips.forEach((c) => {
      if (activeIds.has(c.assetId)) return;
      const v = this.pool.video(c.assetId);
      if (v && !v.paused) v.pause();
    });

    // Fade nhạc nền ở cuối.
    const music = this.project.music;
    if (music) {
      const m = this.pool.audio(music.assetId);
      if (m) {
        const remain = this.duration - t;
        const factor = music.fadeOut > 0 ? Math.min(1, remain / music.fadeOut) : 1;
        mixer.setVolume(m, music.volume * Math.max(0, factor));
      }
    }
  }

  dispose(): void {
    this.pause();
    this.mixer?.close();
    this.mixer = null;
  }
}

function seekElement(el: HTMLMediaElement, time: number): Promise<void> {
  const target = Math.max(0, Math.min(time, (el.duration || time) - 0.01));
  if (Math.abs(el.currentTime - target) < 0.05) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("seeked", done);
      resolve();
    };
    el.addEventListener("seeked", done);
    el.currentTime = target;
    // Phòng trường hợp seeked không bắn (file lỗi) — không treo UI.
    setTimeout(done, 1200);
  });
}

// ---------------------------------------------------------------- Export

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function extensionFor(mime: string): string {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

export type ExportOptions = {
  project: Project;
  /** Canvas ẩn dùng để render (không cần gắn vào DOM). */
  canvas: HTMLCanvasElement;
  /** Mbps. */
  bitrateMbps?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

export type ExportResult = { blob: Blob; mime: string; extension: string };

/**
 * Xuất video: phát timeline theo thời gian thực và ghi lại canvas + audio.
 * Trả về Blob tải xuống được (MP4 nếu trình duyệt hỗ trợ, không thì WebM).
 *
 * Dùng MediaPool riêng chứ không dùng chung với preview: mỗi phần tử media chỉ
 * được nối vào đúng một AudioContext, nối lần hai sẽ lỗi.
 */
export async function exportProject(opts: ExportOptions): Promise<ExportResult> {
  const { project, canvas, onProgress, signal } = opts;

  if (typeof MediaRecorder === "undefined") {
    throw new Error("Trình duyệt không hỗ trợ MediaRecorder — hãy dùng Chrome hoặc Edge bản mới.");
  }
  if (project.clips.length === 0) {
    throw new Error("Timeline chưa có clip nào.");
  }

  const mime = pickMimeType();
  const duration = totalDuration(project);

  const pool = new MediaPool();
  await pool.loadProject(project);

  const player = new Player({ project, pool, canvas });
  await player.seek(0);

  const stream = canvas.captureStream(project.fps);
  // audioStream() phải gọi trước khi play để mixer kịp gắn vào các element.
  const audio = player.audioStream();
  audio?.getAudioTracks().forEach((track) => stream.addTrack(track));

  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: Math.round((opts.bitrateMbps ?? 8) * 1_000_000),
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
    recorder.onerror = () => reject(new Error("Ghi hình thất bại"));
  });

  // Chạy hết timeline (hoặc tới khi bị huỷ).
  const played = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      player.pause();
      resolve();
    };
    player.setCallbacks((t) => onProgress?.(duration > 0 ? t / duration : 1), finish);
    signal?.addEventListener("abort", finish);
  });

  recorder.start(250);
  try {
    await player.play();
    await played;

    // Chờ một nhịp để recorder nuốt nốt frame cuối.
    await new Promise((r) => setTimeout(r, 350));
    if (recorder.state !== "inactive") recorder.stop();

    const blob = await finished;
    onProgress?.(1);
    return { blob, mime: mime || "video/webm", extension: extensionFor(mime || "video/webm") };
  } finally {
    player.dispose();
    pool.dispose();
  }
}

/** Xuất 1 khung hình thành ảnh PNG (poster/thumbnail). */
export function exportFrame(
  project: Project,
  pool: MediaPool,
  t: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  drawFrame(ctx, project, pool, t);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
