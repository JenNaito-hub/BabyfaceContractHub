"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productionStore, projectStore, scriptStore, talentStore } from "@/lib/video/db";
import type { Production, Project, ScriptDoc, VideoTalent } from "@/lib/video/types";
import { totalDuration } from "@/lib/video/render";
import { PageHead, formatTime } from "./ui";

const TOOLS = [
  {
    href: "/video/editor",
    title: "Editor",
    desc: "Ghép clip, cắt, chèn chữ, nhạc nền, logo → xuất file video thật.",
    tag: "Dựng tay",
  },
  {
    href: "/video/showreel",
    title: "Showreel tự động",
    desc: "Chọn talent trong hồ sơ, chọn template, app tự dựng video giới thiệu.",
    tag: "Tự động",
  },
  {
    href: "/video/script",
    title: "Kịch bản AI",
    desc: "Nhập brief → sinh logline, hook, voiceover, shotlist và prompt cho AI video.",
    tag: "Claude",
  },
  {
    href: "/video/production",
    title: "Quản lý sản xuất",
    desc: "Dự án quay, lịch, ê-kíp, deliverable, link review và trạng thái duyệt cut.",
    tag: "Vận hành",
  },
];

export default function HomeClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [talents, setTalents] = useState<VideoTalent[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [scripts, setScripts] = useState<ScriptDoc[]>([]);

  useEffect(() => {
    void Promise.all([
      projectStore.list(),
      talentStore.list(),
      productionStore.list(),
      scriptStore.list(),
    ]).then(([p, t, pr, s]) => {
      setProjects(p.sort((a, b) => b.updatedAt - a.updatedAt));
      setTalents(t);
      setProductions(pr);
      setScripts(s.sort((a, b) => b.createdAt - a.createdAt));
    });
  }, []);

  const activeProductions = productions.filter((p) => p.status !== "done").length;

  return (
    <>
      <PageHead
        title="Babyface Video Studio"
        desc="Bốn công cụ trong một app: dựng video, showreel talent, kịch bản AI và quản lý sản xuất."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Project video" value={projects.length} href="/video/editor" />
        <Stat label="Talent" value={talents.length} href="/video/talents" />
        <Stat label="Dự án đang chạy" value={activeProductions} href="/video/production" />
        <Stat label="Kịch bản" value={scripts.length} href="/video/script" />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card group transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">{t.title}</h2>
              <span className="badge bg-lime text-dark">{t.tag}</span>
            </div>
            <p className="text-sm text-dark/60">{t.desc}</p>
            <p className="mt-3 text-sm font-semibold text-dark group-hover:underline">Mở →</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-extrabold">Project gần đây</h2>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dark/20 bg-white/50 px-6 py-10 text-center">
            <p className="text-sm text-dark/55">
              Chưa có project nào. Bắt đầu ở{" "}
              <Link href="/video/media" className="font-semibold underline">
                Thư viện
              </Link>{" "}
              — tải vài clip lên, rồi qua Editor hoặc Showreel.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-dark/10 bg-white">
            <table className="w-full">
              <thead className="border-b border-dark/10 bg-dark/[0.03]">
                <tr>
                  <th className="th">Tên</th>
                  <th className="th">Khung</th>
                  <th className="th">Clip</th>
                  <th className="th">Dài</th>
                  <th className="th">Sửa lúc</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-b border-dark/5 last:border-0 hover:bg-dark/[0.02]">
                    <td className="td">
                      <Link href={`/video/editor/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      {p.origin === "showreel" && (
                        <span className="badge ml-2 bg-dark/8 text-dark/60">showreel</span>
                      )}
                    </td>
                    <td className="td text-dark/60">
                      {p.width}×{p.height}
                    </td>
                    <td className="td text-dark/60">{p.clips.length}</td>
                    <td className="td tabular-nums text-dark/60">
                      {formatTime(totalDuration(p))}
                    </td>
                    <td className="td text-dark/60">
                      {new Date(p.updatedAt).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card py-4 transition hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">{label}</p>
      <p className="font-display text-2xl font-extrabold">{value}</p>
    </Link>
  );
}
