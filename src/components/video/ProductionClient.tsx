"use client";

import { useEffect, useState } from "react";
import { productionStore, uid } from "@/lib/video/db";
import type {
  Deliverable,
  Production,
  ProductionStatus,
  ShootDay,
} from "@/lib/video/types";
import { Empty, Field, PageHead, formatVND, useToast } from "./ui";

const STATUS: { id: ProductionStatus; label: string; cls: string }[] = [
  { id: "planning", label: "Lên kế hoạch", cls: "bg-dark/10 text-dark/70" },
  { id: "shooting", label: "Đang quay", cls: "bg-lime text-dark" },
  { id: "editing", label: "Đang dựng", cls: "bg-dark text-paper" },
  { id: "review", label: "Chờ duyệt", cls: "bg-warning/20 text-warning" },
  { id: "done", label: "Hoàn tất", cls: "bg-dark/8 text-dark/50" },
];

const DELIVERABLE_STATUS: { id: Deliverable["status"]; label: string }[] = [
  { id: "todo", label: "Chưa làm" },
  { id: "wip", label: "Đang dựng" },
  { id: "review", label: "Chờ duyệt" },
  { id: "approved", label: "Đã duyệt" },
];

function blank(): Production {
  const now = Date.now();
  return {
    id: uid("prod"),
    name: "",
    client: "",
    status: "planning",
    budget: 0,
    startDate: "",
    endDate: "",
    crew: [],
    shootDays: [],
    deliverables: [],
    note: "",
    createdAt: now,
    updatedAt: now,
  };
}

export default function ProductionClient() {
  const [items, setItems] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Production | null>(null);
  const toast = useToast();

  const reload = async () => {
    setItems((await productionStore.list()).sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Cần nhập tên dự án");
      return;
    }
    await productionStore.put({ ...draft, name: draft.name.trim(), updatedAt: Date.now() });
    setDraft(null);
    await reload();
    toast.show("Đã lưu dự án");
  };

  const remove = async (p: Production) => {
    if (!confirm(`Xoá dự án "${p.name}"?`)) return;
    await productionStore.remove(p.id);
    await reload();
    toast.show("Đã xoá dự án");
  };

  const patchDraft = (fn: (p: Production) => Production) =>
    setDraft((cur) => (cur ? fn(cur) : cur));

  const totals = {
    active: items.filter((p) => p.status !== "done").length,
    budget: items.reduce((s, p) => s + (p.budget || 0), 0),
    pending: items.reduce(
      (s, p) => s + p.deliverables.filter((d) => d.status !== "approved").length,
      0,
    ),
  };

  return (
    <>
      <PageHead
        title="Quản lý sản xuất"
        desc="Dự án quay: lịch, ê-kíp, ngân sách, deliverable và trạng thái duyệt cut."
        action={
          <button type="button" className="btn-primary" onClick={() => setDraft(blank())}>
            + Dự án mới
          </button>
        }
      />

      {items.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="card py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">Đang chạy</p>
            <p className="font-display text-xl font-extrabold">{totals.active}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">
              Deliverable chưa duyệt
            </p>
            <p className="font-display text-xl font-extrabold">{totals.pending}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">
              Tổng ngân sách
            </p>
            <p className="font-display text-xl font-extrabold">{formatVND(totals.budget)} đ</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-dark/50">Đang tải…</p>
      ) : items.length === 0 ? (
        <Empty
          title="Chưa có dự án sản xuất nào"
          desc="Tạo dự án để theo dõi lịch quay, ê-kíp và các bản cut cần khách duyệt."
        />
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const st = STATUS.find((s) => s.id === p.status) ?? STATUS[0];
            const approved = p.deliverables.filter((d) => d.status === "approved").length;
            const open = openId === p.id;
            return (
              <div key={p.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold">{p.name}</h3>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-dark/55">
                      {p.client || "Chưa có khách"}
                      {p.startDate && ` · ${p.startDate}${p.endDate ? ` → ${p.endDate}` : ""}`}
                    </p>
                    <p className="mt-0.5 text-xs text-dark/45">
                      {p.shootDays.length} ngày quay · {approved}/{p.deliverables.length}{" "}
                      deliverable đã duyệt
                      {p.budget > 0 && ` · ${formatVND(p.budget)} đ`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setOpenId(open ? null : p.id)}
                    >
                      {open ? "Thu gọn" : "Chi tiết"}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setDraft(p)}>
                      Sửa
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => void remove(p)}>
                      Xoá
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-4 grid gap-4 border-t border-dark/10 pt-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-2 font-display text-sm font-bold">Lịch quay</h4>
                      {p.shootDays.length === 0 ? (
                        <p className="text-sm text-dark/45">Chưa có ngày quay.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {p.shootDays.map((d) => (
                            <li key={d.id} className="rounded-lg bg-dark/[0.04] px-3 py-2">
                              <span className="font-semibold">{d.date || "?"}</span>
                              {d.callTime && ` · call ${d.callTime}`}
                              {d.location && ` · ${d.location}`}
                              {d.note && <p className="text-xs text-dark/55">{d.note}</p>}
                            </li>
                          ))}
                        </ul>
                      )}

                      {p.crew.length > 0 && (
                        <>
                          <h4 className="mb-2 mt-4 font-display text-sm font-bold">Ê-kíp</h4>
                          <div className="flex flex-wrap gap-1">
                            {p.crew.map((c) => (
                              <span key={c} className="badge bg-dark/8 text-dark/70">
                                {c}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <h4 className="mb-2 font-display text-sm font-bold">Deliverable</h4>
                      {p.deliverables.length === 0 ? (
                        <p className="text-sm text-dark/45">Chưa có deliverable.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {p.deliverables.map((d) => (
                            <li key={d.id} className="rounded-lg bg-dark/[0.04] px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold">{d.name}</span>
                                <span className="badge bg-white text-dark/70">
                                  {DELIVERABLE_STATUS.find((s) => s.id === d.status)?.label}
                                </span>
                              </div>
                              <p className="text-xs text-dark/55">
                                {d.spec}
                                {d.due && ` · hạn ${d.due}`}
                              </p>
                              {d.link && (
                                <a
                                  href={d.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold underline"
                                >
                                  Mở link review
                                </a>
                              )}
                              {d.note && <p className="text-xs text-dark/55">{d.note}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {p.note && (
                      <div className="md:col-span-2">
                        <h4 className="mb-1 font-display text-sm font-bold">Ghi chú</h4>
                        <p className="whitespace-pre-wrap text-sm text-dark/70">{p.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-dark/50 p-4">
          <div className="mx-auto my-8 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 font-display text-lg font-extrabold">
              {items.some((p) => p.id === draft.id) ? "Sửa dự án" : "Dự án mới"}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên dự án">
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => patchDraft((p) => ({ ...p, name: e.target.value }))}
                />
              </Field>
              <Field label="Khách hàng">
                <input
                  className="input"
                  value={draft.client}
                  onChange={(e) => patchDraft((p) => ({ ...p, client: e.target.value }))}
                />
              </Field>
              <Field label="Trạng thái">
                <select
                  className="input"
                  value={draft.status}
                  onChange={(e) =>
                    patchDraft((p) => ({ ...p, status: e.target.value as ProductionStatus }))
                  }
                >
                  {STATUS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ngân sách (đ)">
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={draft.budget || ""}
                  onChange={(e) =>
                    patchDraft((p) => ({ ...p, budget: Number(e.target.value) || 0 }))
                  }
                />
              </Field>
              <Field label="Bắt đầu">
                <input
                  type="date"
                  className="input"
                  value={draft.startDate}
                  onChange={(e) => patchDraft((p) => ({ ...p, startDate: e.target.value }))}
                />
              </Field>
              <Field label="Kết thúc">
                <input
                  type="date"
                  className="input"
                  value={draft.endDate}
                  onChange={(e) => patchDraft((p) => ({ ...p, endDate: e.target.value }))}
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Ê-kíp" hint="Cách nhau bằng dấu phẩy">
                <input
                  className="input"
                  placeholder="Đạo diễn Nam, DOP Hải, Stylist Chi"
                  value={draft.crew.join(", ")}
                  onChange={(e) =>
                    patchDraft((p) => ({
                      ...p,
                      crew: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </Field>
            </div>

            {/* Ngày quay */}
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold">Ngày quay</h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patchDraft((p) => ({
                      ...p,
                      shootDays: [
                        ...p.shootDays,
                        { id: uid("day"), date: "", location: "", callTime: "", note: "" },
                      ],
                    }))
                  }
                >
                  + Thêm ngày
                </button>
              </div>
              {draft.shootDays.map((d, i) => (
                <div key={d.id} className="mb-2 grid gap-2 sm:grid-cols-[140px,110px,1fr,auto]">
                  <input
                    type="date"
                    className="input"
                    value={d.date}
                    onChange={(e) => patchDay(patchDraft, i, { date: e.target.value })}
                  />
                  <input
                    type="time"
                    className="input"
                    value={d.callTime}
                    onChange={(e) => patchDay(patchDraft, i, { callTime: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Địa điểm"
                    value={d.location}
                    onChange={(e) => patchDay(patchDraft, i, { location: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      patchDraft((p) => ({
                        ...p,
                        shootDays: p.shootDays.filter((x) => x.id !== d.id),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </section>

            {/* Deliverable */}
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold">Deliverable</h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patchDraft((p) => ({
                      ...p,
                      deliverables: [
                        ...p.deliverables,
                        {
                          id: uid("del"),
                          name: "",
                          spec: "",
                          due: "",
                          status: "todo",
                          link: "",
                          note: "",
                        },
                      ],
                    }))
                  }
                >
                  + Thêm deliverable
                </button>
              </div>
              {draft.deliverables.map((d, i) => (
                <div key={d.id} className="mb-3 rounded-xl border border-dark/10 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr,140px,140px,auto]">
                    <input
                      className="input"
                      placeholder="Tên bản cut"
                      value={d.name}
                      onChange={(e) => patchDel(patchDraft, i, { name: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="9:16 30s"
                      value={d.spec}
                      onChange={(e) => patchDel(patchDraft, i, { spec: e.target.value })}
                    />
                    <select
                      className="input"
                      value={d.status}
                      onChange={(e) =>
                        patchDel(patchDraft, i, {
                          status: e.target.value as Deliverable["status"],
                        })
                      }
                    >
                      {DELIVERABLE_STATUS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        patchDraft((p) => ({
                          ...p,
                          deliverables: p.deliverables.filter((x) => x.id !== d.id),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[140px,1fr]">
                    <input
                      type="date"
                      className="input"
                      value={d.due}
                      onChange={(e) => patchDel(patchDraft, i, { due: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Link review (Drive, Frame.io…)"
                      value={d.link}
                      onChange={(e) => patchDel(patchDraft, i, { link: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </section>

            <div className="mt-4">
              <Field label="Ghi chú">
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={draft.note}
                  onChange={(e) => patchDraft((p) => ({ ...p, note: e.target.value }))}
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>
                Huỷ
              </button>
              <button type="button" className="btn-primary" onClick={() => void save()}>
                Lưu dự án
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.node}
    </>
  );
}

function patchDay(
  patchDraft: (fn: (p: Production) => Production) => void,
  index: number,
  changes: Partial<ShootDay>,
) {
  patchDraft((p) => ({
    ...p,
    shootDays: p.shootDays.map((d, i) => (i === index ? { ...d, ...changes } : d)),
  }));
}

function patchDel(
  patchDraft: (fn: (p: Production) => Production) => void,
  index: number,
  changes: Partial<Deliverable>,
) {
  patchDraft((p) => ({
    ...p,
    deliverables: p.deliverables.map((d, i) => (i === index ? { ...d, ...changes } : d)),
  }));
}
