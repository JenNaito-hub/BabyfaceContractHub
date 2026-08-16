"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { projectStore } from "@/lib/video/db";
import { totalDuration } from "@/lib/video/render";
import { emptyProject } from "@/lib/video/templates";
import { PRESETS, type Project } from "@/lib/video/types";
import { Empty, Field, PageHead, formatTime, useToast } from "./ui";

export default function ProjectListClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const toast = useToast();

  const reload = async () => {
    const rows = await projectStore.list();
    setProjects(rows.sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const create = async () => {
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
    const project = emptyProject(name.trim() || "Project chưa đặt tên", preset.width, preset.height);
    await projectStore.put(project);
    router.push(`/video/editor/${project.id}`);
  };

  const duplicate = async (p: Project) => {
    const copy: Project = {
      ...p,
      id: `${p.id}_copy${Date.now().toString(36)}`,
      name: `${p.name} (bản sao)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await projectStore.put(copy);
    await reload();
    toast.show("Đã nhân bản project");
  };

  const remove = async (p: Project) => {
    if (!confirm(`Xoá project "${p.name}"? File media vẫn còn trong Thư viện.`)) return;
    await projectStore.remove(p.id);
    await reload();
    toast.show("Đã xoá project");
  };

  return (
    <>
      <PageHead
        title="Editor"
        desc="Ghép clip, cắt, chèn chữ và nhạc, rồi xuất ra file video tải về được."
      />

      <div className="card mb-6">
        <h2 className="mb-3 font-display text-base font-bold">Tạo project mới</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr,260px,auto] sm:items-end">
          <Field label="Tên project">
            <input
              className="input"
              value={name}
              placeholder="VD: TVC Tết 2026 — bản 15s"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
            />
          </Field>
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
          <button type="button" className="btn-primary h-[38px]" onClick={() => void create()}>
            Tạo &amp; mở
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-dark/50">Đang tải…</p>
      ) : projects.length === 0 ? (
        <Empty
          title="Chưa có project nào"
          desc="Tạo project ở trên, hoặc qua tab Showreel để app tự dựng một video từ hồ sơ talent."
          action={
            <Link href="/video/showreel" className="btn-ghost">
              Dựng showreel tự động
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="card flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-bold leading-snug">{p.name}</h3>
                {p.origin === "showreel" && (
                  <span className="badge shrink-0 bg-lime text-dark">showreel</span>
                )}
              </div>
              <p className="text-sm text-dark/55">
                {p.width}×{p.height} · {p.clips.length} clip · {formatTime(totalDuration(p))}
              </p>
              <p className="mt-1 text-xs text-dark/40">
                Sửa lần cuối {new Date(p.updatedAt).toLocaleString("vi-VN")}
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/video/editor/${p.id}`} className="btn-dark flex-1">
                  Mở
                </Link>
                <button type="button" className="btn-ghost" onClick={() => void duplicate(p)}>
                  Nhân bản
                </button>
                <button type="button" className="btn-ghost" onClick={() => void remove(p)}>
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast.node}
    </>
  );
}
