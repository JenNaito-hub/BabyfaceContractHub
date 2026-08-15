"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Empty } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatNgay } from "@/lib/sales/calc";
import type {
  InventoryRow,
  Store,
  Transfer,
  TransferItem,
  VariantFull,
} from "@/lib/sales/types";

const TT_LABEL: Record<Transfer["trang_thai"], string> = {
  nhap: "Nháp",
  dang_chuyen: "Đang chuyển",
  da_nhan: "Đã nhận",
  huy: "Huỷ",
};

const TT_CLASS: Record<Transfer["trang_thai"], string> = {
  nhap: "bg-dark/10 text-dark/60",
  dang_chuyen: "bg-amber-100 text-amber-800",
  da_nhan: "bg-lime text-dark",
  huy: "bg-warning/15 text-warning",
};

export default function TransfersClient({
  transfers,
  items,
  stores,
  variants,
  inventory,
}: {
  transfers: Transfer[];
  items: TransferItem[];
  stores: Store[];
  variants: VariantFull[];
  inventory: InventoryRow[];
}) {
  const router = useRouter();
  const [chon, setChon] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soLuong, setSoLuong] = useState("1");
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moTao, setMoTao] = useState(false);
  const [taoForm, setTaoForm] = useState({
    from_store: stores[0]?.id ?? "",
    to_store: stores[1]?.id ?? "",
    ghi_chu: "",
  });

  const storeNames = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s.ten])) as Record<string, string>,
    [stores],
  );
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const tonKho = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(`${r.variant_id}:${r.store_id}`, r.so_luong);
    return m;
  }, [inventory]);

  const itemsByTransfer = useMemo(() => {
    const m = new Map<string, TransferItem[]>();
    for (const it of items) {
      if (!m.has(it.transfer_id)) m.set(it.transfer_id, []);
      m.get(it.transfer_id)!.push(it);
    }
    return m;
  }, [items]);

  const phieu = transfers.find((t) => t.id === chon) ?? null;
  const dongHang = chon ? (itemsByTransfer.get(chon) ?? []) : [];

  const goiY = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key || !phieu) return [];
    return variants
      .filter(
        (v) =>
          v.sku.toLowerCase().includes(key) ||
          (v.product?.ten ?? "").toLowerCase().includes(key) ||
          (v.ten_bien_the ?? "").toLowerCase().includes(key),
      )
      .slice(0, 6);
  }, [q, variants, phieu]);

  async function chay(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setDangLuu(true);
    setLoi(null);
    const { error } = await fn();
    setDangLuu(false);
    if (error) {
      setLoi(error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function taoPhieu() {
    if (taoForm.from_store === taoForm.to_store) {
      setLoi("Kho gửi và kho nhận phải khác nhau");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transfers")
      .insert({
        from_store: taoForm.from_store,
        to_store: taoForm.to_store,
        ghi_chu: taoForm.ghi_chu || null,
      })
      .select("id")
      .maybeSingle();
    if (error) return setLoi(error.message);
    setMoTao(false);
    setChon((data as { id: string } | null)?.id ?? null);
    router.refresh();
  }

  async function themDong(variantId: string) {
    if (!chon) return;
    setQ("");
    const supabase = createClient();
    await chay(() =>
      supabase.from("transfer_items").insert({
        transfer_id: chon,
        variant_id: variantId,
        so_luong: Math.max(1, Number(soLuong) || 1),
      }),
    );
  }

  async function doiTrangThai(next: Transfer["trang_thai"]) {
    if (!phieu) return;
    if (next === "dang_chuyen" && !dongHang.length) {
      setLoi("Phiếu chưa có dòng hàng nào");
      return;
    }
    const supabase = createClient();
    await chay(() => supabase.from("transfers").update({ trang_thai: next }).eq("id", phieu.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/sales/inventory" className="text-xs font-semibold text-dark/50 underline">
            ← Kho
          </Link>
          <h1 className="mt-1 font-display text-2xl font-extrabold">Chuyển kho</h1>
          <p className="text-sm text-dark/60">
            Kho gửi trừ hàng khi bấm “Gửi đi”, kho nhận cộng hàng khi bấm “Đã nhận”.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setMoTao((v) => !v)}>
          + Phiếu chuyển
        </button>
      </div>

      {moTao && (
        <div className="card grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Từ kho</label>
            <select
              className="input"
              value={taoForm.from_store}
              onChange={(e) => setTaoForm({ ...taoForm, from_store: e.target.value })}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ten}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Đến kho</label>
            <select
              className="input"
              value={taoForm.to_store}
              onChange={(e) => setTaoForm({ ...taoForm, to_store: e.target.value })}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ten}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input
              className="input"
              value={taoForm.ghi_chu}
              onChange={(e) => setTaoForm({ ...taoForm, ghi_chu: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button className="btn-dark w-full" onClick={taoPhieu}>
              Tạo phiếu
            </button>
          </div>
        </div>
      )}

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="card p-0">
          {transfers.length === 0 ? (
            <Empty>Chưa có phiếu chuyển</Empty>
          ) : (
            <ul className="divide-y divide-dark/5">
              {transfers.map((t) => (
                <li key={t.id}>
                  <button
                    className={`w-full px-4 py-3 text-left transition hover:bg-dark/[0.03] ${
                      chon === t.id ? "bg-dark/5" : ""
                    }`}
                    onClick={() => setChon(t.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold">{t.ma_phieu}</span>
                      <span className={`badge ${TT_CLASS[t.trang_thai]}`}>
                        {TT_LABEL[t.trang_thai]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-dark/50">
                      {formatNgay(t.ngay)} · {storeNames[t.from_store]} → {storeNames[t.to_store]}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          {!phieu ? (
            <Empty>Chọn một phiếu bên trái</Empty>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold">{phieu.ma_phieu}</h2>
                  <p className="text-sm text-dark/60">
                    {storeNames[phieu.from_store]} → {storeNames[phieu.to_store]}
                  </p>
                </div>
                <div className="flex gap-2">
                  {phieu.trang_thai === "nhap" && (
                    <button
                      className="btn-primary"
                      disabled={dangLuu}
                      onClick={() => doiTrangThai("dang_chuyen")}
                    >
                      Gửi đi
                    </button>
                  )}
                  {phieu.trang_thai === "dang_chuyen" && (
                    <>
                      <button
                        className="btn-ghost"
                        disabled={dangLuu}
                        onClick={() => doiTrangThai("huy")}
                      >
                        Huỷ (trả kho gửi)
                      </button>
                      <button
                        className="btn-primary"
                        disabled={dangLuu}
                        onClick={() => doiTrangThai("da_nhan")}
                      >
                        Đã nhận
                      </button>
                    </>
                  )}
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark/10">
                    <th className="th">Sản phẩm</th>
                    <th className="th text-center">SL chuyển</th>
                    <th className="th text-center">Tồn kho gửi</th>
                  </tr>
                </thead>
                <tbody>
                  {dongHang.map((it) => {
                    const v = variantById.get(it.variant_id);
                    const con = tonKho.get(`${it.variant_id}:${phieu.from_store}`) ?? 0;
                    return (
                      <tr key={it.id} className="border-b border-dark/5">
                        <td className="td">
                          <div className="font-medium">
                            {v?.product?.ten} — {v?.ten_bien_the}
                          </div>
                          <div className="font-mono text-[11px] text-dark/40">{v?.sku}</div>
                        </td>
                        <td className="td text-center font-semibold">{it.so_luong}</td>
                        <td
                          className={`td text-center ${
                            phieu.trang_thai === "nhap" && con < it.so_luong ? "text-warning" : ""
                          }`}
                        >
                          {con}
                        </td>
                      </tr>
                    );
                  })}
                  {dongHang.length === 0 && (
                    <tr>
                      <td className="td text-dark/40" colSpan={3}>
                        Chưa có dòng hàng
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {phieu.trang_thai === "nhap" && (
                <div className="mt-4 space-y-2 border-t border-dark/10 pt-4">
                  <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
                    <input
                      className="input"
                      placeholder="Tìm SKU / tên để thêm…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <input
                      className="input text-center"
                      value={soLuong}
                      onChange={(e) => setSoLuong(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  {goiY.length > 0 && (
                    <ul className="divide-y divide-dark/5 rounded-lg border border-dark/10">
                      {goiY.map((v) => (
                        <li key={v.id}>
                          <button
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-dark/5"
                            onClick={() => themDong(v.id)}
                          >
                            <span className="truncate">
                              {v.product?.ten} — {v.ten_bien_the}
                            </span>
                            <span className="text-xs text-dark/40">
                              còn {tonKho.get(`${v.id}:${phieu.from_store}`) ?? 0}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
