"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { Empty, StatCard } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatNgayGio, formatVND } from "@/lib/sales/calc";
import { LOAI_MOVE_LABEL } from "@/lib/sales/constants";
import { xuatTonKho } from "@/lib/sales/excel";
import type {
  InventoryRow,
  StockMove,
  Store,
  VariantCost,
  VariantFull,
} from "@/lib/sales/types";

export default function InventoryClient({
  stores,
  variants,
  inventory,
  moves,
  costs,
  isManager,
}: {
  stores: Store[];
  variants: VariantFull[];
  inventory: InventoryRow[];
  moves: StockMove[];
  costs: VariantCost[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chiCanhBao, setChiCanhBao] = useState(false);
  const [dieuChinh, setDieuChinh] = useState<{ v: VariantFull; storeId: string } | null>(null);
  const [soMoi, setSoMoi] = useState("0");
  const [lyDo, setLyDo] = useState("");
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const tonKho = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(`${r.variant_id}:${r.store_id}`, r.so_luong);
    return m;
  }, [inventory]);

  const giaVon = useMemo(() => new Map(costs.map((c) => [c.variant_id, c.gia_von])), [costs]);
  const storeNames = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s.ten])) as Record<string, string>,
    [stores],
  );
  const variantNames = useMemo(
    () =>
      Object.fromEntries(
        variants.map((v) => [v.id, `${v.sku} — ${v.product?.ten ?? ""} ${v.ten_bien_the ?? ""}`]),
      ) as Record<string, string>,
    [variants],
  );

  const tongTon = (variantId: string) =>
    stores.reduce((s, st) => s + (tonKho.get(`${variantId}:${st.id}`) ?? 0), 0);

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase();
    return variants.filter((v) => {
      if (chiCanhBao && tongTon(v.id) > v.ton_toi_thieu) return false;
      if (!key) return true;
      return (
        v.sku.toLowerCase().includes(key) ||
        (v.ten_bien_the ?? "").toLowerCase().includes(key) ||
        (v.product?.ten ?? "").toLowerCase().includes(key)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, q, chiCanhBao, tonKho, stores]);

  const tongSoChai = useMemo(() => inventory.reduce((s, r) => s + r.so_luong, 0), [inventory]);
  const giaTriTon = useMemo(
    () =>
      isManager
        ? inventory.reduce((s, r) => s + r.so_luong * (giaVon.get(r.variant_id) ?? 0), 0)
        : 0,
    [inventory, giaVon, isManager],
  );
  const soCanhBao = useMemo(
    () => variants.filter((v) => tongTon(v.id) <= v.ton_toi_thieu).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variants, tonKho, stores],
  );

  async function luuDieuChinh() {
    if (!dieuChinh) return;
    setDangLuu(true);
    setLoi(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("dieu_chinh_ton", {
      p_variant: dieuChinh.v.id,
      p_store: dieuChinh.storeId,
      p_so_luong_thuc: Number(soMoi) || 0,
      p_ly_do: lyDo || null,
    });
    setDangLuu(false);
    if (error) return setLoi(error.message);
    setDieuChinh(null);
    setLyDo("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Kho</h1>
          <p className="text-sm text-dark/60">Tồn kho theo từng cửa hàng</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <>
              <Link href="/sales/inventory/receipts" className="btn-ghost">
                Nhập kho
              </Link>
              <Link href="/sales/inventory/transfers" className="btn-ghost">
                Chuyển kho
              </Link>
            </>
          )}
          <button
            className="btn-dark"
            onClick={() =>
              xuatTonKho(
                variants,
                stores.map((s) => ({ id: s.id, ten: s.ten })),
                tonKho,
                isManager ? giaVon : undefined,
              )
            }
          >
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tổng tồn" value={`${tongSoChai} sp`} sub={`${variants.length} SKU`} />
        {isManager && <StatCard label="Giá trị tồn kho" value={formatVND(giaTriTon)} />}
        <StatCard label="Dưới ngưỡng" value={soCanhBao} sub="SKU cần nhập thêm" />
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <input
          className="input flex-1"
          placeholder="Tìm SKU hoặc tên…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={chiCanhBao}
            onChange={(e) => setChiCanhBao(e.target.checked)}
          />
          Chỉ SKU dưới ngưỡng
        </label>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="card overflow-x-auto p-0">
        {ketQua.length === 0 ? (
          <Empty>Không có SKU nào</Empty>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-dark/10">
                <th className="th sticky left-0 bg-white">SKU / Sản phẩm</th>
                {stores.map((s) => (
                  <th key={s.id} className="th text-center">
                    {s.ten}
                  </th>
                ))}
                <th className="th text-center">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {ketQua.map((v) => {
                const tong = tongTon(v.id);
                return (
                  <tr key={v.id} className="border-b border-dark/5">
                    <td className="td sticky left-0 bg-white">
                      <div className="font-medium">
                        {v.product?.ten} — {v.ten_bien_the}
                      </div>
                      <div className="font-mono text-[11px] text-dark/40">
                        {v.sku} · ngưỡng {v.ton_toi_thieu}
                      </div>
                    </td>
                    {stores.map((s) => {
                      const n = tonKho.get(`${v.id}:${s.id}`) ?? 0;
                      return (
                        <td key={s.id} className="td text-center">
                          {isManager ? (
                            <button
                              className={`rounded-md px-2 py-1 text-sm font-semibold hover:bg-dark/5 ${
                                n <= 0 ? "text-dark/25" : ""
                              }`}
                              onClick={() => {
                                setDieuChinh({ v, storeId: s.id });
                                setSoMoi(String(n));
                              }}
                              title="Bấm để kiểm kho / điều chỉnh"
                            >
                              {n}
                            </button>
                          ) : (
                            <span className={n <= 0 ? "text-dark/25" : ""}>{n}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="td text-center">
                      <span
                        className={`badge ${
                          tong <= 0
                            ? "bg-warning/15 text-warning"
                            : tong <= v.ton_toi_thieu
                              ? "bg-amber-100 text-amber-800"
                              : "bg-dark/5 text-dark/60"
                        }`}
                      >
                        {tong}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-display font-extrabold">Sổ kho gần đây</h2>
        {moves.length === 0 ? (
          <Empty>Chưa có phát sinh</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">Thời gian</th>
                  <th className="th">Loại</th>
                  <th className="th">Sản phẩm</th>
                  <th className="th">Kho</th>
                  <th className="th text-right">Thay đổi</th>
                  <th className="th">Chứng từ</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="border-b border-dark/5">
                    <td className="td whitespace-nowrap text-dark/60">
                      {formatNgayGio(m.created_at)}
                    </td>
                    <td className="td">{LOAI_MOVE_LABEL[m.loai] ?? m.loai}</td>
                    <td className="td max-w-[260px] truncate">
                      {variantNames[m.variant_id] ?? m.variant_id}
                    </td>
                    <td className="td text-dark/70">{storeNames[m.store_id] ?? "—"}</td>
                    <td
                      className={`td text-right font-semibold ${
                        m.delta < 0 ? "text-warning" : ""
                      }`}
                    >
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </td>
                    <td className="td text-xs text-dark/50">{m.ghi_chu ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dieuChinh && (
        <Modal
          title="Kiểm kho / điều chỉnh"
          onClose={() => setDieuChinh(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setDieuChinh(null)}>
                Huỷ
              </button>
              <button className="btn-primary" onClick={luuDieuChinh} disabled={dangLuu}>
                {dangLuu ? "Đang lưu…" : "Cập nhật"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm">
              <strong>
                {dieuChinh.v.product?.ten} — {dieuChinh.v.ten_bien_the}
              </strong>
              <br />
              <span className="text-dark/60">
                {dieuChinh.v.sku} · {storeNames[dieuChinh.storeId]}
              </span>
            </p>
            <div>
              <label className="label">Số lượng đếm thực tế</label>
              <input
                className="input text-right"
                value={soMoi}
                onChange={(e) => setSoMoi(e.target.value.replace(/[^\d]/g, ""))}
              />
              <p className="mt-1 text-xs text-dark/50">
                Hệ thống ghi 1 dòng sổ kho chênh lệch so với tồn hiện tại (
                {tonKho.get(`${dieuChinh.v.id}:${dieuChinh.storeId}`) ?? 0}).
              </p>
            </div>
            <div>
              <label className="label">Lý do</label>
              <input
                className="input"
                value={lyDo}
                onChange={(e) => setLyDo(e.target.value)}
                placeholder="Kiểm kho cuối tháng, vỡ hàng, mất hàng…"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
