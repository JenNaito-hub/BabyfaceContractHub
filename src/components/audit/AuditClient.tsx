"use client";

import { useMemo, useState } from "react";
import type { AuditLog } from "@/lib/types";

const TABLE_LABEL: Record<string, string> = {
  talents: "Talent",
  talent_contacts: "Liên hệ talent",
  jobs: "Job",
  castings: "Casting",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Tạo mới",
  UPDATE: "Sửa",
  DELETE: "Xoá",
};

/** Cột nhạy cảm/ồn — không cần hiện chi tiết trong nhật ký. */
const HIDE_FIELDS = new Set(["id", "created_at", "created_by"]);

function shortValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(trống)";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

function describeChange(log: AuditLog): { field: string; text: string }[] {
  const changed = log.changed ?? {};
  if ("masked" in changed) return [{ field: "", text: "Đã cập nhật (nội dung ẩn)" }];

  return Object.entries(changed)
    .filter(([k]) => !HIDE_FIELDS.has(k))
    .map(([k, v]) => {
      if (Array.isArray(v) && v.length === 2) {
        return { field: k, text: `${shortValue(v[0])} → ${shortValue(v[1])}` };
      }
      return { field: k, text: shortValue(v) };
    })
    .slice(0, 6);
}

export default function AuditClient({
  logs,
  actorNames,
  recordNames,
}: {
  logs: AuditLog[];
  actorNames: Record<string, string>;
  recordNames: Record<string, string>;
}) {
  const [table, setTable] = useState<string>("all");
  const [query, setQuery] = useState("");

  const tables = useMemo(
    () => Array.from(new Set(logs.map((l) => l.table_name))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (table !== "all" && l.table_name !== table) return false;
      if (!q) return true;
      const hay = [
        actorNames[l.actor_id ?? ""] ?? "",
        recordNames[l.record_id ?? ""] ?? "",
        l.table_name,
        JSON.stringify(l.changed ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, table, query, actorNames, recordNames]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">Nhật ký thay đổi</h1>
        <p className="text-sm text-dark/60">
          500 thay đổi gần nhất trên talent, job, casting và liên hệ. Ghi tự động ở tầng database —
          không bỏ sót kể cả khi gọi thẳng API. Nội dung SĐT/email <b>không</b> được lưu vào nhật ký.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            table === "all" ? "bg-dark text-paper" : "bg-dark/5 text-dark/60"
          }`}
          onClick={() => setTable("all")}
        >
          Tất cả
        </button>
        {tables.map((t) => (
          <button
            key={t}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              table === t ? "bg-dark text-paper" : "bg-dark/5 text-dark/60"
            }`}
            onClick={() => setTable(t)}
          >
            {TABLE_LABEL[t] ?? t}
          </button>
        ))}
        <input
          className="input ml-auto max-w-xs"
          placeholder="Tìm theo người sửa, tên talent/job…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">Thời gian</th>
              <th className="th">Người thực hiện</th>
              <th className="th">Hành động</th>
              <th className="th">Đối tượng</th>
              <th className="th">Thay đổi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const changes = describeChange(l);
              return (
                <tr key={l.id} className="border-b border-dark/5 last:border-0 align-top">
                  <td className="td whitespace-nowrap text-dark/60">
                    {new Date(l.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="td">
                    {l.actor_id ? (actorNames[l.actor_id] ?? l.actor_id.slice(0, 8)) : "hệ thống"}
                  </td>
                  <td className="td">
                    <span
                      className={`badge ${
                        l.action === "DELETE"
                          ? "bg-warning/15 text-warning"
                          : l.action === "INSERT"
                            ? "bg-lime text-dark"
                            : "bg-dark/5 text-dark/60"
                      }`}
                    >
                      {ACTION_LABEL[l.action] ?? l.action}
                    </span>
                  </td>
                  <td className="td">
                    <div className="font-semibold">{TABLE_LABEL[l.table_name] ?? l.table_name}</div>
                    <div className="text-xs text-dark/40">
                      {(l.record_id && recordNames[l.record_id]) ??
                        l.record_id?.slice(0, 8) ??
                        "—"}
                    </div>
                  </td>
                  <td className="td">
                    {changes.length === 0 ? (
                      <span className="text-dark/40">—</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs">
                        {changes.map((c, i) => (
                          <li key={i}>
                            {c.field && <span className="font-semibold">{c.field}: </span>}
                            <span className="text-dark/70">{c.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-dark/40" colSpan={5}>
                  Chưa có nhật ký nào khớp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
