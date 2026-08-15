"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { projectStore, uid } from "@/lib/video/db";
import { useAssets } from "@/lib/video/hooks";
import {
  MediaPool,
  Player,
  clipStart,
  downloadBlob,
  exportFrame,
  exportProject,
  pickMimeType,
  totalDuration,
} from "@/lib/video/render";
import { defaultCaption } from "@/lib/video/templates";
import { PRESETS, type Asset, type Caption, type Clip, type Project } from "@/lib/video/types";
import { AssetGrid, UploadButton } from "./MediaPicker";
import { Field, Slider, formatTime, useToast } from "./ui";

const CAPTION_STYLES: { id: string; label: string; color: string; background: string }[] = [
  { id: "dark", label: "Hộp tối", color: "#EFEEEA", background: "rgba(26,26,26,0.72)" },
  { id: "lime", label: "Hộp lime", color: "#1A1A1A", background: "#D7F205" },
  { id: "paper", label: "Hộp sáng", color: "#1A1A1A", background: "rgba(239,238,234,0.88)" },
  { id: "plain", label: "Chữ trắng, có bóng", color: "#FFFFFF", background: "" },
  { id: "limeplain", label: "Chữ lime, có bóng", color: "#D7F205", background: "" },
];

function makeClip(asset: Asset): Clip {
  const duration =
    asset.kind === "video" && asset.duration > 0 ? Math.min(5, asset.duration) : 3;
  return {
    id: uid("clip"),
    assetId: asset.id,
    trimStart: 0,
    duration,
    fit: "cover",
    zoom: 1,
    transition: "fade",
    muted: asset.kind !== "video",
    volume: 1,
  };
}

export default function EditorClient({ projectId }: { projectId: string }) {
  const { assets, busy, upload, reload } = useAssets();
  const toast = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [poolReady, setPoolReady] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [exportPct, setExportPct] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<MediaPool | null>(null);
  const playerRef = useRef<Player | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const duration = project ? totalDuration(project) : 0;
  const selected = project?.clips.find((c) => c.id === selectedId) ?? null;

  // ---- nạp project
  useEffect(() => {
    void projectStore.get(projectId).then((p) => {
      if (p) setProject(p);
      else setMissing(true);
    });
  }, [projectId]);

  // ---- autosave
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => {
      void projectStore.put({ ...project, updatedAt: Date.now() });
    }, 700);
    return () => clearTimeout(t);
  }, [project]);

  // ---- nạp media pool khi danh sách asset của project đổi
  const assetKey = useMemo(() => {
    if (!project) return "";
    return [
      ...project.clips.map((c) => c.assetId),
      project.music?.assetId ?? "",
      project.watermark?.assetId ?? "",
    ].join("|");
  }, [project]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const pool = poolRef.current ?? new MediaPool();
    poolRef.current = pool;
    setPoolReady(false);
    void pool
      .loadProject(project)
      .then(() => {
        if (cancelled) return;
        setPoolError(null);
        setPoolReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPoolError(e instanceof Error ? e.message : "Không nạp được media");
        setPoolReady(true);
      });
    return () => {
      cancelled = true;
    };
    // Chỉ chạy lại khi tập asset thay đổi, không phải mỗi lần sửa clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey]);

  // ---- tạo / cập nhật player
  useEffect(() => {
    if (!project || !poolReady || !canvasRef.current || !poolRef.current) return;
    if (!playerRef.current) {
      playerRef.current = new Player({
        project,
        pool: poolRef.current,
        canvas: canvasRef.current,
        onTime: (t) => setTime(t),
        onEnd: () => setPlaying(false),
      });
      playerRef.current.render();
    } else {
      playerRef.current.updateProject(project);
    }
  }, [project, poolReady]);

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
      poolRef.current?.dispose();
      poolRef.current = null;
    };
  }, []);

  // ---- helpers cập nhật project
  const patch = useCallback((fn: (p: Project) => Project) => {
    setProject((prev) => (prev ? fn(prev) : prev));
  }, []);

  const patchClip = useCallback(
    (clipId: string, fn: (c: Clip) => Clip) => {
      patch((p) => ({ ...p, clips: p.clips.map((c) => (c.id === clipId ? fn(c) : c)) }));
    },
    [patch],
  );

  const addClips = (list: Asset[]) => {
    if (list.length === 0) return;
    patch((p) => ({ ...p, clips: [...p.clips, ...list.map(makeClip)] }));
    toast.show(`Đã thêm ${list.length} clip`);
  };

  const moveClip = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    patch((p) => {
      if (to < 0 || to >= p.clips.length) return p;
      const clips = [...p.clips];
      [clips[index], clips[to]] = [clips[to], clips[index]];
      return { ...p, clips };
    });
  };

  const removeClip = (clipId: string) => {
    patch((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== clipId) }));
    if (selectedId === clipId) setSelectedId(null);
  };

  // ---- transport
  const togglePlay = async () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.playing) {
      player.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      await player.play();
    }
  };

  const seekTo = async (t: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    setPlaying(false);
    await player.seek(t);
    setTime(t);
  };

  const jumpToClip = (index: number) => {
    if (!project) return;
    void seekTo(clipStart(project, index) + 0.05);
  };

  // ---- xuất file
  const doExport = async () => {
    if (!project || project.clips.length === 0) {
      toast.error("Timeline chưa có clip nào");
      return;
    }
    playerRef.current?.pause();
    setPlaying(false);

    const controller = new AbortController();
    abortRef.current = controller;
    setExportPct(0);

    try {
      const canvas = document.createElement("canvas");
      const result = await exportProject({
        project,
        canvas,
        onProgress: (r) => setExportPct(Math.round(r * 100)),
        signal: controller.signal,
      });
      const safe = project.name.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "video";
      downloadBlob(result.blob, `${safe}.${result.extension}`);
      toast.show(`Đã xuất ${result.extension.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xuất video thất bại");
    } finally {
      setExportPct(null);
      abortRef.current = null;
    }
  };

  const doExportFrame = async () => {
    if (!project || !poolRef.current) return;
    const blob = await exportFrame(project, poolRef.current, time);
    if (!blob) {
      toast.error("Không tạo được ảnh");
      return;
    }
    downloadBlob(blob, `${project.name || "poster"}-${time.toFixed(1)}s.png`);
    toast.show("Đã lưu ảnh khung hình");
  };

  if (missing) {
    return (
      <div className="rounded-2xl border border-dashed border-dark/20 bg-white/50 px-6 py-12 text-center">
        <p className="font-display text-base font-bold">Không tìm thấy project</p>
        <p className="mt-1 text-sm text-dark/55">
          Project có thể đã bị xoá, hoặc bạn đang mở bằng trình duyệt khác.
        </p>
        <Link href="/video/editor" className="btn-ghost mt-4">
          Về danh sách project
        </Link>
      </div>
    );
  }

  if (!project) {
    return <p className="py-16 text-center text-sm text-dark/50">Đang mở project…</p>;
  }

  const exporting = exportPct !== null;
  const mime = typeof window !== "undefined" ? pickMimeType() : "";

  return (
    <>
      {/* Thanh trên */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/video/editor" className="text-sm font-semibold text-dark/50 hover:text-dark">
          ← Project
        </Link>
        <input
          className="input max-w-xs font-display font-bold"
          value={project.name}
          onChange={(e) => patch((p) => ({ ...p, name: e.target.value }))}
        />
        <span className="text-sm text-dark/50">
          {project.width}×{project.height} · {formatTime(duration)}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => void doExportFrame()}>
            Lưu khung hình
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting}
            onClick={() => void doExport()}
          >
            {exporting ? `Đang xuất ${exportPct}%` : "Xuất video"}
          </button>
          {exporting && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => abortRef.current?.abort()}
            >
              Dừng
            </button>
          )}
        </div>
      </div>

      {exporting && (
        <div className="mb-4 rounded-xl border border-dark/10 bg-white p-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-dark/10">
            <div
              className="h-full rounded-full bg-lime transition-[width]"
              style={{ width: `${exportPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-dark/55">
            Xuất chạy theo thời gian thực ({formatTime(duration)}) — giữ tab này ở trước, đừng
            chuyển tab để tránh rớt khung hình.
          </p>
        </div>
      )}

      {poolError && (
        <p className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          {poolError} — có thể một file trong Thư viện đã bị xoá.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),340px]">
        {/* Preview + timeline */}
        <div>
          <div className="rounded-2xl border border-dark/10 bg-dark p-3">
            <div className="mx-auto flex max-h-[58vh] justify-center">
              <canvas
                ref={canvasRef}
                className="max-h-[58vh] max-w-full rounded-lg bg-black object-contain"
                style={{ aspectRatio: `${project.width} / ${project.height}` }}
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-lime text-dark"
                onClick={() => void togglePlay()}
                disabled={project.clips.length === 0}
                aria-label={playing ? "Tạm dừng" : "Phát"}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.05}
                value={Math.min(time, duration)}
                onChange={(e) => void seekTo(Number(e.target.value))}
                className="w-full accent-lime"
              />
              <span className="shrink-0 tabular-nums text-sm text-paper/80">
                {formatTime(time)} / {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">
                Timeline ({project.clips.length} clip)
              </h2>
              <button type="button" className="btn-dark" onClick={() => setDrawer((v) => !v)}>
                {drawer ? "Đóng" : "+ Thêm clip"}
              </button>
            </div>

            {drawer && (
              <div className="card mb-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm text-dark/60">Bấm vào file để thêm vào cuối timeline.</p>
                  <UploadButton
                    accept="video/*,image/*"
                    busy={busy}
                    label="Tải thêm"
                    onFiles={async (files) => {
                      const added = await upload(files);
                      addClips(added);
                    }}
                  />
                </div>
                <AssetGrid
                  assets={assets}
                  kinds={["video", "image"]}
                  onToggle={(a) => addClips([a])}
                  emptyText="Thư viện chưa có video/ảnh. Bấm “Tải thêm” để bắt đầu."
                />
              </div>
            )}

            {project.clips.length === 0 ? (
              <p className="rounded-xl border border-dashed border-dark/20 bg-white/50 px-4 py-8 text-center text-sm text-dark/55">
                Timeline trống. Bấm “+ Thêm clip” để chọn video hoặc ảnh.
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {project.clips.map((clip, i) => {
                  const asset = assetMap.get(clip.assetId);
                  const isSel = clip.id === selectedId;
                  return (
                    <div
                      key={clip.id}
                      className={`w-36 shrink-0 overflow-hidden rounded-xl border bg-white ${
                        isSel ? "border-dark ring-2 ring-lime" : "border-dark/12"
                      }`}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => {
                          setSelectedId(clip.id);
                          jumpToClip(i);
                        }}
                      >
                        <div className="aspect-video w-full bg-dark/8">
                          {asset?.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-xs text-dark/40">
                              thiếu file
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="truncate text-[11px] font-semibold">
                            {i + 1}. {asset?.name ?? "?"}
                          </p>
                          <p className="text-[11px] text-dark/50">
                            {clip.duration.toFixed(1)}s · {clip.transition}
                          </p>
                        </div>
                      </button>
                      <div className="flex border-t border-dark/10 text-xs">
                        <button
                          type="button"
                          className="flex-1 py-1 hover:bg-dark/5 disabled:opacity-30"
                          disabled={i === 0}
                          onClick={() => moveClip(i, -1)}
                          aria-label="Chuyển sang trái"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="flex-1 border-x border-dark/10 py-1 hover:bg-dark/5 disabled:opacity-30"
                          disabled={i === project.clips.length - 1}
                          onClick={() => moveClip(i, 1)}
                          aria-label="Chuyển sang phải"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="flex-1 py-1 text-warning hover:bg-warning/10"
                          onClick={() => removeClip(clip.id)}
                          aria-label="Xoá clip"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inspector */}
        <aside className="space-y-4">
          {selected ? (
            <ClipInspector
              clip={selected}
              asset={assetMap.get(selected.assetId)}
              onChange={(fn) => patchClip(selected.id, fn)}
            />
          ) : (
            <div className="card">
              <h2 className="font-display text-base font-bold">Chưa chọn clip</h2>
              <p className="mt-1 text-sm text-dark/55">
                Bấm vào một clip ở timeline để chỉnh thời lượng, cắt, chữ và hiệu ứng.
              </p>
            </div>
          )}

          <ProjectInspector
            project={project}
            assets={assets}
            onChange={patch}
            onUpload={upload}
            uploading={busy}
            onReloadAssets={reload}
          />

          <div className="card">
            <h2 className="mb-1 font-display text-base font-bold">Định dạng xuất</h2>
            <p className="text-sm text-dark/55">
              {mime
                ? `Trình duyệt này xuất ${mime.startsWith("video/mp4") ? "MP4" : "WebM"} (${mime.split(";")[0]}).`
                : "Trình duyệt không hỗ trợ MediaRecorder — dùng Chrome hoặc Edge bản mới để xuất video."}
            </p>
            <p className="mt-2 text-xs text-dark/45">
              WebM mở được trên Chrome/Edge và hầu hết web. Nếu cần MP4 để gửi client, chuyển
              nhanh bằng bất kỳ tool convert nào.
            </p>
          </div>
        </aside>
      </div>

      {toast.node}
    </>
  );
}

// ------------------------------------------------------------- Inspector clip

function ClipInspector({
  clip,
  asset,
  onChange,
}: {
  clip: Clip;
  asset?: Asset;
  onChange: (fn: (c: Clip) => Clip) => void;
}) {
  const isVideo = asset?.kind === "video";
  const maxTrim = isVideo ? Math.max(0, (asset?.duration ?? 0) - 0.5) : 0;
  const maxDuration = isVideo
    ? Math.max(0.5, (asset?.duration ?? 0) - clip.trimStart)
    : 30;

  const setCaption = (fn: (c: Caption) => Caption) =>
    onChange((c) => (c.caption ? { ...c, caption: fn(c.caption) } : c));

  return (
    <div className="card">
      <h2 className="mb-1 font-display text-base font-bold">Clip đang chọn</h2>
      <p className="mb-3 truncate text-xs text-dark/50">{asset?.name ?? "File không còn"}</p>

      <div className="space-y-3">
        <Slider
          label="Thời lượng"
          value={clip.duration}
          min={0.5}
          max={Math.max(1, Math.min(30, maxDuration))}
          step={0.1}
          suffix="s"
          onChange={(v) => onChange((c) => ({ ...c, duration: v }))}
        />

        {isVideo && maxTrim > 0 && (
          <Slider
            label="Cắt từ giây"
            value={clip.trimStart}
            min={0}
            max={maxTrim}
            step={0.1}
            suffix="s"
            onChange={(v) => onChange((c) => ({ ...c, trimStart: v }))}
          />
        )}

        <Slider
          label="Zoom chậm"
          value={clip.zoom}
          min={1}
          max={1.4}
          step={0.01}
          suffix="×"
          onChange={(v) => onChange((c) => ({ ...c, zoom: v }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Khung hình">
            <select
              className="input"
              value={clip.fit}
              onChange={(e) =>
                onChange((c) => ({ ...c, fit: e.target.value as Clip["fit"] }))
              }
            >
              <option value="cover">Lấp đầy (cắt viền)</option>
              <option value="contain">Vừa khung (có viền)</option>
            </select>
          </Field>
          <Field label="Chuyển cảnh">
            <select
              className="input"
              value={clip.transition}
              onChange={(e) =>
                onChange((c) => ({ ...c, transition: e.target.value as Clip["transition"] }))
              }
            >
              <option value="none">Cắt thẳng</option>
              <option value="fade">Mờ dần</option>
              <option value="slide">Trượt ngang</option>
            </select>
          </Field>
        </div>

        {isVideo && (
          <>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={clip.muted}
                onChange={(e) => onChange((c) => ({ ...c, muted: e.target.checked }))}
              />
              Tắt tiếng gốc của clip
            </label>
            {!clip.muted && (
              <Slider
                label="Âm lượng gốc"
                value={clip.volume}
                min={0}
                max={1.5}
                step={0.05}
                onChange={(v) => onChange((c) => ({ ...c, volume: v }))}
              />
            )}
          </>
        )}

        <div className="border-t border-dark/10 pt-3">
          {!clip.caption ? (
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => onChange((c) => ({ ...c, caption: defaultCaption("Nhập chữ") }))}
            >
              + Chèn chữ lên clip
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold">Chữ trên clip</h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-warning"
                  onClick={() => onChange((c) => ({ ...c, caption: undefined }))}
                >
                  Bỏ chữ
                </button>
              </div>

              <Field label="Dòng chính">
                <input
                  className="input"
                  value={clip.caption.text}
                  onChange={(e) => setCaption((c) => ({ ...c, text: e.target.value }))}
                />
              </Field>
              <Field label="Dòng phụ">
                <input
                  className="input"
                  value={clip.caption.sub ?? ""}
                  placeholder="Vai diễn, ghi chú…"
                  onChange={(e) => setCaption((c) => ({ ...c, sub: e.target.value }))}
                />
              </Field>

              <Field label="Kiểu chữ">
                <select
                  className="input"
                  value={
                    CAPTION_STYLES.find(
                      (s) =>
                        s.color === clip.caption?.color &&
                        s.background === clip.caption?.background,
                    )?.id ?? "custom"
                  }
                  onChange={(e) => {
                    const style = CAPTION_STYLES.find((s) => s.id === e.target.value);
                    if (style)
                      setCaption((c) => ({
                        ...c,
                        color: style.color,
                        background: style.background,
                      }));
                  }}
                >
                  {CAPTION_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                  <option value="custom">Tuỳ chỉnh</option>
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Căn lề">
                  <select
                    className="input"
                    value={clip.caption.align}
                    onChange={(e) =>
                      setCaption((c) => ({ ...c, align: e.target.value as Caption["align"] }))
                    }
                  >
                    <option value="left">Trái</option>
                    <option value="center">Giữa</option>
                    <option value="right">Phải</option>
                  </select>
                </Field>
                <Field label="Màu chữ">
                  <input
                    type="color"
                    className="input h-[38px] p-1"
                    value={clip.caption.color}
                    onChange={(e) => setCaption((c) => ({ ...c, color: e.target.value }))}
                  />
                </Field>
              </div>

              <Slider
                label="Cỡ chữ"
                value={clip.caption.size}
                min={2}
                max={12}
                step={0.1}
                suffix="%"
                onChange={(v) => setCaption((c) => ({ ...c, size: v }))}
              />
              <Slider
                label="Vị trí ngang"
                value={clip.caption.x}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => setCaption((c) => ({ ...c, x: v }))}
              />
              <Slider
                label="Vị trí dọc"
                value={clip.caption.y}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => setCaption((c) => ({ ...c, y: v }))}
              />
              <Slider
                label="Hiện sau"
                value={clip.caption.delay}
                min={0}
                max={Math.max(0.1, clip.duration - 0.2)}
                step={0.1}
                suffix="s"
                onChange={(v) => setCaption((c) => ({ ...c, delay: v }))}
              />
              <Slider
                label="Giữ trong (0 = tới hết clip)"
                value={clip.caption.hold}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(v) => setCaption((c) => ({ ...c, hold: v }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- Inspector project

function ProjectInspector({
  project,
  assets,
  onChange,
  onUpload,
  uploading,
  onReloadAssets,
}: {
  project: Project;
  assets: Asset[];
  onChange: (fn: (p: Project) => Project) => void;
  onUpload: (files: FileList) => Promise<Asset[]>;
  uploading: boolean;
  onReloadAssets: () => Promise<void>;
}) {
  const audios = assets.filter((a) => a.kind === "audio");
  const images = assets.filter((a) => a.kind === "image");

  return (
    <div className="card space-y-3">
      <h2 className="font-display text-base font-bold">Cài đặt project</h2>

      <Field label="Khung hình">
        <select
          className="input"
          value={
            PRESETS.find((p) => p.width === project.width && p.height === project.height)?.id ??
            "custom"
          }
          onChange={(e) => {
            const preset = PRESETS.find((p) => p.id === e.target.value);
            if (preset)
              onChange((p) => ({ ...p, width: preset.width, height: preset.height }));
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Tuỳ chỉnh ({project.width}×{project.height})</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="FPS">
          <select
            className="input"
            value={project.fps}
            onChange={(e) => onChange((p) => ({ ...p, fps: Number(e.target.value) }))}
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </Field>
        <Field label="Nền">
          <input
            type="color"
            className="input h-[38px] p-1"
            value={project.background}
            onChange={(e) => onChange((p) => ({ ...p, background: e.target.value }))}
          />
        </Field>
      </div>

      {/* Nhạc nền */}
      <div className="border-t border-dark/10 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">Nhạc nền</h3>
          <UploadButton
            accept="audio/*"
            multiple={false}
            busy={uploading}
            label="Tải nhạc"
            onFiles={async (files) => {
              const added = await onUpload(files);
              await onReloadAssets();
              if (added[0])
                onChange((p) => ({
                  ...p,
                  music: { assetId: added[0].id, volume: 0.85, fadeOut: 1.5 },
                }));
            }}
          />
        </div>
        <select
          className="input"
          value={project.music?.assetId ?? ""}
          onChange={(e) =>
            onChange((p) => ({
              ...p,
              music: e.target.value
                ? { assetId: e.target.value, volume: p.music?.volume ?? 0.85, fadeOut: p.music?.fadeOut ?? 1.5 }
                : undefined,
            }))
          }
        >
          <option value="">Không dùng nhạc</option>
          {audios.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.duration.toFixed(0)}s)
            </option>
          ))}
        </select>
        {project.music && (
          <div className="mt-3 space-y-3">
            <Slider
              label="Âm lượng nhạc"
              value={project.music.volume}
              min={0}
              max={1.5}
              step={0.05}
              onChange={(v) =>
                onChange((p) => (p.music ? { ...p, music: { ...p.music, volume: v } } : p))
              }
            />
            <Slider
              label="Nhỏ dần ở cuối"
              value={project.music.fadeOut}
              min={0}
              max={5}
              step={0.1}
              suffix="s"
              onChange={(v) =>
                onChange((p) => (p.music ? { ...p, music: { ...p.music, fadeOut: v } } : p))
              }
            />
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="border-t border-dark/10 pt-3">
        <h3 className="mb-2 font-display text-sm font-bold">Logo / watermark</h3>
        <select
          className="input"
          value={project.watermark?.assetId ?? ""}
          onChange={(e) =>
            onChange((p) => ({
              ...p,
              watermark: e.target.value
                ? {
                    assetId: e.target.value,
                    x: p.watermark?.x ?? 88,
                    y: p.watermark?.y ?? 8,
                    scale: p.watermark?.scale ?? 14,
                    opacity: p.watermark?.opacity ?? 0.9,
                  }
                : undefined,
            }))
          }
        >
          <option value="">Không dùng logo</option>
          {images.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {project.watermark && (
          <div className="mt-3 space-y-3">
            <Slider
              label="Vị trí ngang"
              value={project.watermark.x}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                onChange((p) =>
                  p.watermark ? { ...p, watermark: { ...p.watermark, x: v } } : p,
                )
              }
            />
            <Slider
              label="Vị trí dọc"
              value={project.watermark.y}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                onChange((p) =>
                  p.watermark ? { ...p, watermark: { ...p.watermark, y: v } } : p,
                )
              }
            />
            <Slider
              label="Kích thước"
              value={project.watermark.scale}
              min={4}
              max={50}
              suffix="%"
              onChange={(v) =>
                onChange((p) =>
                  p.watermark ? { ...p, watermark: { ...p.watermark, scale: v } } : p,
                )
              }
            />
            <Slider
              label="Độ mờ"
              value={project.watermark.opacity}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) =>
                onChange((p) =>
                  p.watermark ? { ...p, watermark: { ...p.watermark, opacity: v } } : p,
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
