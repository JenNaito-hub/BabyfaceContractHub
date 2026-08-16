"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { projectStore, scriptStore, uid } from "@/lib/video/db";
import { useAssets } from "@/lib/video/hooks";
import { assetsToRefImages } from "@/lib/video/imageref";
import { offlineScript, projectFromScript } from "@/lib/video/templates";
import { PRESETS, type Asset, type ScriptDoc, type ScriptRequest } from "@/lib/video/types";
import { AssetThumb, UploadButton } from "./MediaPicker";
import { Empty, Field, PageHead, Slider, useToast } from "./ui";

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "reels", label: "Instagram Reels" },
  { id: "youtube", label: "YouTube" },
  { id: "tvc", label: "TVC / quảng cáo" },
  { id: "profile", label: "Profile talent" },
];

const TONES = ["năng lượng", "cảm xúc", "hài hước", "sang trọng", "chân thật", "gấp gáp"];

export default function ScriptClient() {
  const toast = useToast();
  const router = useRouter();
  const [docs, setDocs] = useState<ScriptDoc[]>([]);
  const [active, setActive] = useState<ScriptDoc | null>(null);
  const [running, setRunning] = useState(false);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [refIds, setRefIds] = useState<string[]>([]);
  const { assets, busy: uploading, upload } = useAssets();

  const images = useMemo(() => assets.filter((a) => a.kind === "image"), [assets]);
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const MAX_REFS = 4;

  const toggleRef = (asset: Asset) =>
    setRefIds((cur) =>
      cur.includes(asset.id)
        ? cur.filter((id) => id !== asset.id)
        : cur.length >= MAX_REFS
          ? cur
          : [...cur, asset.id],
    );

  const [form, setForm] = useState<ScriptRequest>({
    brief: "",
    platform: "reels",
    durationSec: 30,
    tone: "năng lượng",
    language: "Tiếng Việt",
    shotCount: 6,
  });

  const reload = async () => {
    const rows = await scriptStore.list();
    setDocs(rows.sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => {
    void reload();
  }, []);

  const generate = async () => {
    if (!form.brief.trim()) {
      toast.error("Nhập brief trước đã");
      return;
    }
    setRunning(true);
    try {
      // Thu nhỏ ảnh trước khi gửi — ảnh gốc dễ vượt giới hạn body của server.
      const refImages = refIds.length ? await assetsToRefImages(refIds) : [];

      const res = await fetch("/api/video/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          images: refImages.map((r) => ({
            name: r.name,
            mediaType: r.mediaType,
            data: r.data,
          })),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { script: Omit<ScriptDoc, "id" | "ai" | "createdAt" | "brief" | "platform" | "durationSec" | "tone" | "language"> };
        const doc: ScriptDoc = {
          ...data.script,
          id: uid("script"),
          brief: form.brief,
          platform: form.platform,
          durationSec: form.durationSec,
          tone: form.tone,
          language: form.language,
          ai: true,
          referenceAssetIds: refIds.length ? [...refIds] : undefined,
          createdAt: Date.now(),
        };
        await scriptStore.put(doc);
        setActive(doc);
        await reload();
        toast.show("Claude đã viết xong kịch bản");
      } else {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        // Không có API key hoặc lỗi upstream → vẫn cho ra khung kịch bản offline.
        const doc = { ...offlineScript(form), referenceAssetIds: refIds.length ? [...refIds] : undefined };
        await scriptStore.put(doc);
        setActive(doc);
        await reload();
        toast.error(`${err.message ?? "Không gọi được Claude"} Đã tạo bản offline.`);
      }
    } catch {
      const doc = { ...offlineScript(form), referenceAssetIds: refIds.length ? [...refIds] : undefined };
      await scriptStore.put(doc);
      setActive(doc);
      await reload();
      toast.error("Mất kết nối. Đã tạo bản offline.");
    } finally {
      setRunning(false);
    }
  };

  const remove = async (doc: ScriptDoc) => {
    if (!confirm(`Xoá kịch bản "${doc.title}"?`)) return;
    await scriptStore.remove(doc.id);
    if (active?.id === doc.id) setActive(null);
    await reload();
  };

  /** Biến shotlist thành project storyboard rồi mở Editor. */
  const buildProject = async (doc: ScriptDoc) => {
    if (doc.shots.length === 0) {
      toast.error("Kịch bản chưa có cảnh nào");
      return;
    }
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
    const project = projectFromScript(doc, preset.width, preset.height);
    await projectStore.put(project);
    router.push(`/video/editor/${project.id}`);
  };

  const copyAll = async (doc: ScriptDoc) => {
    try {
      await navigator.clipboard.writeText(asText(doc));
      toast.show("Đã copy toàn bộ kịch bản");
    } catch {
      toast.error("Trình duyệt chặn clipboard");
    }
  };

  return (
    <>
      <PageHead
        title="Kịch bản AI"
        desc="Nhập brief → nhận logline, hook, voiceover, shotlist và prompt tiếng Anh để đưa thẳng vào công cụ sinh video AI."
      />

      <div className="grid gap-5 lg:grid-cols-[340px,minmax(0,1fr)]">
        {/* Form */}
        <aside className="space-y-4">
          <div className="card space-y-3">
            <Field label="Brief" hint="Càng cụ thể càng tốt: sản phẩm, đối tượng, thông điệp, bối cảnh.">
              <textarea
                className="input min-h-[130px] resize-y"
                placeholder="VD: Quảng cáo trà sữa vị khoai môn mới cho sinh viên 18–24, quay tại quán, nhấn giá 29k và topping miễn phí."
                value={form.brief}
                onChange={(e) => setForm({ ...form, brief: e.target.value })}
              />
            </Field>

            {/* Ảnh tham chiếu: brief bằng chữ không tả nổi sản phẩm trông ra sao. */}
            <div className="border-t border-dark/10 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="label mb-0">
                  Ảnh tham chiếu {refIds.length > 0 && `(${refIds.length}/${MAX_REFS})`}
                </span>
                <UploadButton
                  accept="image/*"
                  busy={uploading}
                  label="Tải ảnh"
                  onFiles={async (files) => {
                    const added = await upload(files);
                    setRefIds((cur) =>
                      [...cur, ...added.filter((a) => a.kind === "image").map((a) => a.id)].slice(
                        0,
                        MAX_REFS,
                      ),
                    );
                  }}
                />
              </div>
              <p className="mb-2 text-xs text-dark/50">
                Ảnh sản phẩm, talent hoặc bối cảnh. Claude nhìn ảnh rồi viết cho khớp màu sắc,
                kiểu dáng thật — thay vì tả chung chung.
              </p>

              {images.length === 0 ? (
                <p className="rounded-lg bg-dark/[0.04] px-3 py-2 text-xs text-dark/50">
                  Chưa có ảnh nào trong Thư viện. Bấm “Tải ảnh” để thêm.
                </p>
              ) : (
                <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">
                  {images.map((a) => {
                    const order = refIds.indexOf(a.id) + 1;
                    const full = refIds.length >= MAX_REFS && order === 0;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        title={full ? `Tối đa ${MAX_REFS} ảnh` : a.name}
                        disabled={full}
                        onClick={() => toggleRef(a)}
                        className={`relative aspect-square overflow-hidden rounded-lg border transition disabled:opacity-40 ${
                          order > 0 ? "border-dark ring-2 ring-lime" : "border-dark/15"
                        }`}
                      >
                        <AssetThumb asset={a} />
                        {order > 0 && (
                          <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-lime text-[10px] font-extrabold text-dark">
                            {order}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nền tảng">
                <select
                  className="input"
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tông giọng">
                <select
                  className="input"
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Slider
              label="Thời lượng"
              value={form.durationSec}
              min={10}
              max={180}
              step={5}
              suffix="s"
              onChange={(v) => setForm({ ...form, durationSec: v })}
            />
            <Slider
              label="Số cảnh"
              value={form.shotCount}
              min={3}
              max={16}
              onChange={(v) => setForm({ ...form, shotCount: v })}
            />

            <Field label="Ngôn ngữ kịch bản">
              <select
                className="input"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option>Tiếng Việt</option>
                <option>English</option>
              </select>
            </Field>

            <button
              type="button"
              className="btn-primary w-full"
              disabled={running}
              onClick={() => void generate()}
            >
              {running ? "Claude đang viết…" : "Viết kịch bản"}
            </button>
            <p className="text-xs text-dark/45">
              Cần <code className="rounded bg-dark/8 px-1">ANTHROPIC_API_KEY</code> ở server. Chưa
              có key thì app vẫn tạo được khung shotlist offline.
            </p>
          </div>

          {docs.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-display text-base font-bold">Đã lưu ({docs.length})</h2>
              <ul className="space-y-1">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActive(d)}
                      className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                        active?.id === d.id ? "bg-dark text-paper" : "hover:bg-dark/5"
                      }`}
                    >
                      {d.title}
                      {!d.ai && <span className="ml-1 text-xs opacity-60">(offline)</span>}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-warning"
                      onClick={() => void remove(d)}
                    >
                      Xoá
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Kết quả */}
        <section>
          {!active ? (
            <Empty
              title="Chưa có kịch bản nào đang mở"
              desc="Nhập brief bên trái rồi bấm “Viết kịch bản”. Kết quả gồm hook, voiceover, shotlist và prompt AI cho từng cảnh."
            />
          ) : (
            <ScriptView
              doc={active}
              refAssets={(active.referenceAssetIds ?? [])
                .map((id) => assetMap.get(id))
                .filter((a): a is Asset => !!a)}
              presetId={presetId}
              onPreset={setPresetId}
              onBuild={() => void buildProject(active)}
              onCopyAll={() => void copyAll(active)}
              onCopy={(text) => {
                void navigator.clipboard.writeText(text).then(
                  () => toast.show("Đã copy"),
                  () => toast.error("Trình duyệt chặn clipboard"),
                );
              }}
            />
          )}
        </section>
      </div>

      {toast.node}
    </>
  );
}

function ScriptView({
  doc,
  refAssets,
  presetId,
  onPreset,
  onBuild,
  onCopy,
  onCopyAll,
}: {
  doc: ScriptDoc;
  refAssets: Asset[];
  presetId: string;
  onPreset: (id: string) => void;
  onBuild: () => void;
  onCopy: (text: string) => void;
  onCopyAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-extrabold">{doc.title}</h2>
            <p className="text-sm text-dark/55">
              {doc.platform} · {doc.durationSec}s · giọng {doc.tone} · {doc.shots.length} cảnh
            </p>
          </div>
          <div className="flex gap-2">
            <span className={`badge ${doc.ai ? "bg-lime text-dark" : "bg-dark/10 text-dark/60"}`}>
              {doc.ai ? "Claude" : "Offline"}
            </span>
            <button type="button" className="btn-ghost" onClick={onCopyAll}>
              Copy tất cả
            </button>
          </div>
        </div>
        <p className="text-sm">{doc.logline}</p>

        {refAssets.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-dark/50">
              Viết dựa trên
            </span>
            <div className="flex gap-1.5">
              {refAssets.map((a) => (
                <div
                  key={a.id}
                  title={a.name}
                  className="h-10 w-10 overflow-hidden rounded-lg border border-dark/15"
                >
                  <AssetThumb asset={a} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-dark/10 pt-3">
          <label className="min-w-[200px] flex-1">
            <span className="label">Khung hình cho bản dựng</span>
            <select
              className="input"
              value={presetId}
              onChange={(e) => onPreset(e.target.value)}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary h-[38px]" onClick={onBuild}>
            Dựng khung trong Editor →
          </button>
        </div>
        <p className="mt-2 text-xs text-dark/50">
          Tạo project với {doc.shots.length} clip trống mang sẵn chữ của từng cảnh — vào Editor
          gắn footage vào là xong.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wide text-dark/60">
            Hook — 3 giây đầu
          </h3>
          <p className="text-sm">{doc.hook}</p>
        </div>
        <div className="card">
          <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wide text-dark/60">
            Kêu gọi hành động
          </h3>
          <p className="text-sm">{doc.cta}</p>
        </div>
      </div>

      {doc.voiceover.length > 0 && (
        <div className="card">
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-dark/60">
            Voiceover
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {doc.voiceover.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-display text-base font-bold">Shotlist</h3>
        <div className="space-y-3">
          {doc.shots.map((s, i) => (
            <div key={i} className="card">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-sm font-bold">{s.shot}</h4>
                <span className="badge bg-dark/8 text-dark/70">{s.duration}</span>
              </div>
              <p className="text-sm">{s.description}</p>
              <dl className="mt-2 grid gap-1 text-xs text-dark/60 sm:grid-cols-2">
                <div>
                  <dt className="inline font-semibold">Máy: </dt>
                  <dd className="inline">{s.camera}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Âm thanh: </dt>
                  <dd className="inline">{s.audio}</dd>
                </div>
              </dl>
              <div className="mt-2 rounded-lg bg-dark/[0.04] p-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-dark/50">
                    Prompt AI video
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold underline"
                    onClick={() => onCopy(s.aiPrompt)}
                  >
                    Copy
                  </button>
                </div>
                <p className="font-mono text-xs leading-relaxed text-dark/75">{s.aiPrompt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function asText(doc: ScriptDoc): string {
  const lines = [
    `# ${doc.title}`,
    `${doc.platform} · ${doc.durationSec}s · giọng ${doc.tone}`,
    "",
    `Logline: ${doc.logline}`,
    `Hook: ${doc.hook}`,
    "",
    "## Voiceover",
    ...doc.voiceover.map((v, i) => `${i + 1}. ${v}`),
    "",
    "## Shotlist",
  ];
  doc.shots.forEach((s) => {
    lines.push(
      `\n${s.shot} (${s.duration})`,
      `- Nội dung: ${s.description}`,
      `- Máy: ${s.camera}`,
      `- Âm thanh: ${s.audio}`,
      `- Prompt AI: ${s.aiPrompt}`,
    );
  });
  lines.push("", `CTA: ${doc.cta}`);
  return lines.join("\n");
}
