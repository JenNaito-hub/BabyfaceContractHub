"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { projectStore, talentStore } from "@/lib/video/db";
import { useAssets } from "@/lib/video/hooks";
import { totalDuration } from "@/lib/video/render";
import { SHOWREEL_TEMPLATES, buildShowreel } from "@/lib/video/templates";
import { PRESETS, type Project, type VideoTalent } from "@/lib/video/types";
import { AssetThumb } from "./MediaPicker";
import { Empty, Field, PageHead, Slider, formatTime, useToast } from "./ui";

export default function ShowreelClient() {
  const router = useRouter();
  const { assets } = useAssets();
  const toast = useToast();

  const [talents, setTalents] = useState<VideoTalent[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState(SHOWREEL_TEMPLATES[0].id);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [perTalent, setPerTalent] = useState(2);
  const [musicId, setMusicId] = useState("");
  const [name, setName] = useState("");

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const audios = assets.filter((a) => a.kind === "audio");
  const template = SHOWREEL_TEMPLATES.find((t) => t.id === templateId) ?? SHOWREEL_TEMPLATES[0];
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  useEffect(() => {
    void talentStore.list().then((rows) => {
      setTalents(rows.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
  }, []);

  // Chỉ tính talent có ít nhất 1 ảnh/clip dùng được.
  const usable = talents.filter((t) =>
    t.mediaIds.some((id) => {
      const a = assetMap.get(id);
      return a && a.kind !== "audio";
    }),
  );

  const chosen = picked
    .map((id) => usable.find((t) => t.id === id))
    .filter((t): t is VideoTalent => !!t);

  const preview: Project | null = useMemo(() => {
    if (chosen.length === 0) return null;
    return buildShowreel({
      name: name.trim() || `Showreel ${new Date().toLocaleDateString("vi-VN")}`,
      width: preset.width,
      height: preset.height,
      template,
      talents: chosen,
      assets: assetMap,
      musicAssetId: musicId || undefined,
      perTalent,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, templateId, presetId, perTalent, musicId, name, assetMap, talents]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const build = async () => {
    if (!preview) {
      toast.error("Chọn ít nhất 1 talent");
      return;
    }
    if (preview.clips.length === 0) {
      toast.error("Talent đã chọn chưa có ảnh/clip dùng được");
      return;
    }
    await projectStore.put(preview);
    router.push(`/video/editor/${preview.id}`);
  };

  return (
    <>
      <PageHead
        title="Showreel tự động"
        desc="Chọn talent → chọn template → app tự dựng timeline có thẻ tên, chuyển cảnh và nhạc nền. Dựng xong mở thẳng trong Editor để chỉnh và xuất."
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-dark/50">Đang tải…</p>
      ) : usable.length === 0 ? (
        <Empty
          title="Chưa có talent nào kèm ảnh/clip"
          desc="Vào tab Talent để thêm hồ sơ và gắn ảnh hoặc clip cho từng người, rồi quay lại đây."
          action={
            <Link href="/video/talents" className="btn-primary">
              Thêm talent
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),340px]">
          <div>
            <h2 className="mb-2 font-display text-base font-bold">
              Chọn talent ({picked.length} đã chọn — thứ tự bấm là thứ tự xuất hiện)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {usable.map((t) => {
                const order = picked.indexOf(t.id) + 1;
                const media = t.mediaIds
                  .map((id) => assetMap.get(id))
                  .filter((a) => a && a.kind !== "audio");
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`relative flex gap-3 rounded-2xl border bg-white p-3 text-left transition ${
                      order > 0 ? "border-dark ring-2 ring-lime" : "border-dark/12 hover:shadow-sm"
                    }`}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-dark/8">
                      {media[0] && <AssetThumb asset={media[0]} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold">{t.name}</p>
                      <p className="truncate text-xs text-dark/55">{t.role || "—"}</p>
                      <p className="text-xs text-dark/40">{media.length} file</p>
                    </div>
                    {order > 0 && (
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-lime text-xs font-extrabold text-dark">
                        {order}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card space-y-3">
              <h2 className="font-display text-base font-bold">Thiết lập</h2>

              <Field label="Tên showreel">
                <input
                  className="input"
                  placeholder="VD: Casting — Nước ngọt Tết"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field label="Template">
                <select
                  className="input"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {SHOWREEL_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="-mt-1 text-xs text-dark/50">{template.desc}</p>

              <Field label="Khung hình">
                <select
                  className="input"
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Slider
                label="Số file mỗi talent"
                value={perTalent}
                min={1}
                max={5}
                onChange={setPerTalent}
              />

              <Field label="Nhạc nền">
                <select
                  className="input"
                  value={musicId}
                  onChange={(e) => setMusicId(e.target.value)}
                >
                  <option value="">Không nhạc</option>
                  {audios.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.duration.toFixed(0)}s)
                    </option>
                  ))}
                </select>
              </Field>
              {audios.length === 0 && (
                <p className="-mt-1 text-xs text-dark/45">
                  Chưa có nhạc trong{" "}
                  <Link href="/video/media" className="underline">
                    Thư viện
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="card">
              <h2 className="mb-2 font-display text-base font-bold">Kết quả dự kiến</h2>
              {preview ? (
                <>
                  <dl className="space-y-1 text-sm">
                    <Row label="Talent" value={`${chosen.length}`} />
                    <Row label="Số clip" value={`${preview.clips.length}`} />
                    <Row label="Thời lượng" value={formatTime(totalDuration(preview))} />
                    <Row label="Khung" value={`${preview.width}×${preview.height}`} />
                  </dl>
                  <button type="button" className="btn-primary mt-4 w-full" onClick={() => void build()}>
                    Dựng &amp; mở trong Editor
                  </button>
                </>
              ) : (
                <p className="text-sm text-dark/55">Chọn talent ở bên trái để xem trước.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {toast.node}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-dark/55">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
