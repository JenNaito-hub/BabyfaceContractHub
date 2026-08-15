"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Empty } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatNgay, formatVND } from "@/lib/sales/calc";
import type { ReceiptItem, StockReceipt, Store, VariantFull } from "@/lib/sales/types";

export default function ReceiptsClient({
  receipts,
  items,
  stores,
  variants,
}: {
  receipts: StockReceipt[];
  items: ReceiptItem[];
  stores: Store[];
  variants: VariantFull[];
}) {
  const router = useRouter();
  const [chon, setChon] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soLuong, setSoLuong] = useState("1");
  const [giaNhap, setGiaNhap] = useState("0");
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moTao, setMoTao] = useState(false);
  const [taoForm, setTaoForm] = useState({
    store_id: stores[0]?.id ?? "",
    nha_cung_cap: "",
    ghi_chu: "",
  });

  const storeNames = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s.ten])) as Record<string, string>,
    [stores],
  );
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  const itemsByReceipt = useMemo(() => {
    const m = new Map<string, ReceiptItem[]>();
    for (const it of items) {
      if (!m.has(it.receipt_id)) m.set(it.receipt_id, []);
      m.get(it.receipt_id)!.push(it);
    }
    return m;
  }, [items]);

  const phieu = receipts.find((r) => r.id === chon) ?? null;
  const dongHang = chon ? (itemsByReceipt.get(chon) ?? []) : [];
  const tongTien = dongHang.reduce((s, it) => s + it.so_luong * it.gia_nhap, 0);

  const goiY = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return [];
    return variants
      .filter(
        (v) =>
          v.sku.toLowerCase().includes(key) ||
          (v.product?.ten ?? "").toLowerCase().includes(key) ||
          (v.ten_bien_the ?? "").toLowerCase().includes(key),
      )
      .slice(0, 6);
  }, [q, variants]);

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("stock_receipts")
      .insert({
        store_id: taoForm.store_id,
        nha_cung_cap: taoForm.nha_cung_cap || null,
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
      supabase.from("receipt_items").insert({
        receipt_id: chon,
        variant_id: variantId,
        so_luong: Math.max(1, Number(soLuong) || 1),
        gia_nhap: Number(giaNhap) || 0,
      }),
    );
  }

  async function xoaDong(id: string) {
    const supabase = createClient();
    await chay(() => supabase.from("receipt_items").delete().eq("id", id));
  }

  async function doiTrangThai(next: "nhap" | "hoan_thanh") {
    if (!phieu) return;
    if (next === "hoan_thanh" && !dongHang.length) {
      setLoi("Phiếu chưa có dòng hàng nào");
      return;
    }
    const supabase = createClient();
    await chay(() =>
      supabase.from("stock_receipts").update({ trang_thai: next }).eq("id", phieu.id),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/sales/inventory" className="text-xs font-semibold text-dark/50 underline">
            ← Kho
          </Link>
          <h1 className="mt-1 font-display text-2xl font-extrabold">Nhập kho</h1>
          <p className="text-sm text-dark/60">
            Giá nhập ở đây tự cập nhật thành giá vốn mới của SKU khi hoàn thành phiếu.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setMoTao((v) => !v)}>
          + Phiếu nhập
        </button>
      </div>

      {moTao && (
        <div className="card grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Nhập vào kho</label>
            <select
              className="input"
              value={taoForm.store_id}
              onChange={(e) => setTaoForm({ ...taoForm, store_id: e.target.value })}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ten}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nhà cung cấp</label>
            <input
              className="input"
              value={taoForm.nha_cung_cap}
              onChange={(e) => setTaoForm({ ...taoForm, nha_cung_cap: e.target.value })}
            />
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
          {receipts.length === 0 ? (
            <Empty>Chưa có phiếu nhập</Empty>
          ) : (
            <ul className="divide-y divide-dark/5">
              {receipts.map((r) => (
                <li key={r.id}>
                  <button
                    className={`w-full px-4 py-3 text-left transition hover:bg-dark/[0.03] ${
                      chon === r.id ? "bg-dark/5" : ""
                    }`}
                    onClick={() => setChon(r.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold">{r.ma_phieu}</span>
                      <span
                        className={`badge ${
                          r.trang_thai === "hoan_thanh"
                            ? "bg-lime text-dark"
                            : "bg-dark/10 text-dark/60"
                        }`}
                      >
                        {r.trang_thai === "hoan_thanh" ? "Đã nhập" : "Nháp"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-dark/50">
                      {formatNgay(r.ngay)} · {storeNames[r.store_id] ?? "—"}
                      {r.nha_cung_cap ? ` · ${r.nha_cung_cap}` : ""}
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
                    {storeNames[phieu.store_id]} · {formatNgay(phieu.ngay)}
                  </p>
                </div>
                {phieu.trang_thai === "nhap" ? (
                  <button
                    className="btn-primary"
                    disabled={dangLuu}
                    onClick={() => doiTrangThai("hoan_thanh")}
                  >
                    Hoàn thành nhập kho
                  </button>
                ) : (
                  <button
                    className="btn-ghost"
                    disabled={dangLuu}
                    onClick={() => doiTrangThai("nhap")}
                  >
                    Huỷ nhập (trả kho)
                  </button>
                )}
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark/10">
                    <th className="th">Sản phẩm</th>
                    <th className="th text-center">SL</th>
                    <th className="th text-right">Giá nhập</th>
                    <th className="th text-right">Thành tiền</th>
                    {phieu.trang_thai === "nhap" && <th className="th" />}
                  </tr>
                </thead>
                <tbody>
                  {dongHang.map((it) => {
                    const v = variantById.get(it.variant_id);
                    return (
                      <tr key={it.id} className="border-b border-dark/5">
                        <td className="td">
                          <div className="font-medium">
                            {v?.product?.ten} — {v?.ten_bien_the}
                          </div>
                          <div className="font-mono text-[11px] text-dark/40">{v?.sku}</div>
                        </td>
                        <td className="td text-center">{it.so_luong}</td>
                        <td className="td text-right">{formatVND(it.gia_nhap)}</td>
                        <td className="td text-right font-semibold">
                          {formatVND(it.so_luong * it.gia_nhap)}
                        </td>
                        {phieu.trang_thai === "nhap" && (
                          <td className="td text-right">
                            <button
                              className="text-dark/30 hover:text-warning"
                              onClick={() => xoaDong(it.id)}
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {dongHang.length === 0 && (
                    <tr>
                      <td className="td text-dark/40" colSpan={5}>
                        Chưa có dòng hàng
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="td font-semibold" colSpan={3}>
                      Tổng giá trị nhập
                    </td>
                    <td className="td text-right font-display font-extrabold">
                      {formatVND(tongTien)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>

              {phieu.trang_thai === "nhap" && (
                <div className="mt-4 space-y-2 border-t border-dark/10 pt-4">
                  <div className="grid gap-2 sm:grid-cols-[1fr_90px_140px]">
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
                      placeholder="SL"
                    />
                    <input
                      className="input text-right"
                      value={giaNhap}
                      onChange={(e) => setGiaNhap(e.target.value.replace(/\D/g, ""))}
                      placeholder="Giá nhập"
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
                            <span className="font-mono text-xs text-dark/40">{v.sku}</span>
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
