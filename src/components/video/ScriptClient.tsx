"use client";

import { useEffect, useState } from "react";
import { scriptStore, uid } from "@/lib/video/db";
import { offlineScript } from "@/lib/video/templates";
import type { ScriptDoc, ScriptRequest } from "@/lib/video/types";
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
  const [docs, setDocs] = useState<ScriptDoc[]>([]);
  const [active, setActive] = useState<ScriptDoc | null>(null);
  const [running, setRunning] = useState(false);

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
      const res = await fetch("/api/video/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
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
          createdAt: Date.now(),
        };
        await scriptStore.put(doc);
        setActive(doc);
        await reload();
        toast.show("Claude đã viết xong kịch bản");
      } else {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        // Không có API key hoặc lỗi upstream → vẫn cho ra khung kịch bản offline.
        const doc = offlineScript(form);
        await scriptStore.put(doc);
        setActive(doc);
        await reload();
        toast.error(`${err.message ?? "Không gọi được Claude"} Đã tạo bản offline.`);
      }
    } catch {
      const doc = offlineScript(form);
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
            <ScriptView doc={active} onCopyAll={() => void copyAll(active)} onCopy={(text) => {
              void navigator.clipboard.writeText(text).then(
                () => toast.show("Đã copy"),
                () => toast.error("Trình duyệt chặn clipboard"),
              );
            }} />
          )}
        </section>
      </div>

      {toast.node}
    </>
  );
}

function ScriptView({
  doc,
  onCopy,
  onCopyAll,
}: {
  doc: ScriptDoc;
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
