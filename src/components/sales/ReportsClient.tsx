"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ColumnChart } from "@/components/sales/SalesCharts";
import { Empty, StatCard } from "@/components/sales/Bits";
import {
  doanhThuTheoNgay,
  formatVND,
  gopDoanhThu,
  laDoanhThu,
  tienDongHang,
  tinhThongKe,
} from "@/lib/sales/calc";
import { KENH_LABEL, TRANG_THAI_LABEL, TRANG_THAI_LIST } from "@/lib/sales/constants";
import { xuatBaoCaoThang } from "@/lib/sales/excel";
import type { Order, OrderItem, OrderItemCost, Store } from "@/lib/sales/types";

export default function ReportsClient({
  tu,
  den,
  orders,
  items,
  costs,
  stores,
}: {
  tu: string;
  den: string;
  orders: Order[];
  items: OrderItem[];
  costs: OrderItemCost[];
  stores: Store[];
}) {
  const router = useRouter();
  const [tuLocal, setTuLocal] = useState(tu);
  const [denLocal, setDenLocal] = useState(den);

  const storeNames = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s.ten])) as Record<string, string>,
    [stores],
  );

  const costByItem = useMemo(
    () => new Map(costs.map((c) => [c.order_item_id, c.gia_von])),
    [costs],
  );

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const it of items) {
      if (!m.has(it.order_id)) m.set(it.order_id, []);
      m.get(it.order_id)!.push(it);
    }
    return m;
  }, [items]);

  const stats = useMemo(
    () => tinhThongKe(orders, itemsByOrder, costByItem),
    [orders, itemsByOrder, costByItem],
  );

  const theoNgay = useMemo(() => {
    const d1 = new Date(tu + "T00:00:00");
    const d2 = new Date(den + "T00:00:00");
    d2.setDate(d2.getDate() + 1);
    return doanhThuTheoNgay(orders, d1, d2);
  }, [orders, tu, den]);

  /** Doanh thu + lãi gộp theo kênh. */
  const theoKenh = useMemo(() => {
    const dt = new Map(gopDoanhThu(orders, (o) => o.kenh).map((r) => [r.label, r]));
    const von = new Map<string, number>();
    const hang = new Map<string, number>();

    const kenhCuaDon = new Map(orders.map((o) => [o.id, o]));
    for (const it of items) {
      const o = kenhCuaDon.get(it.order_id);
      if (!o || !laDoanhThu(o.trang_thai)) continue;
      von.set(o.kenh, (von.get(o.kenh) ?? 0) + (costByItem.get(it.id) ?? 0) * it.so_luong);
      hang.set(o.kenh, (hang.get(o.kenh) ?? 0) + tienDongHang(it));
    }

    return [...dt.values()]
      .map((r) => {
        const v = von.get(r.label) ?? 0;
        const h = hang.get(r.label) ?? 0;
        return {
          kenh: r.label,
          soDon: r.soDon,
          doanhThu: r.doanhThu,
          tienHang: h,
          giaVon: v,
          lai: h - v,
          bien: h ? Math.round(((h - v) / h) * 100) : 0,
        };
      })
      .sort((a, b) => b.doanhThu - a.doanhThu);
  }, [orders, items, costByItem]);

  /** Lãi gộp theo SKU. */
  const theoSku = useMemo(() => {
    const okOrders = new Set(orders.filter((o) => laDoanhThu(o.trang_thai)).map((o) => o.id));
    const m = new Map<
      string,
      { sku: string; ten: string; sl: number; doanhThu: number; von: number }
    >();

    for (const it of items) {
      if (!okOrders.has(it.order_id)) continue;
      const k = it.sku ?? it.variant_id ?? "?";
      const cur = m.get(k) ?? {
        sku: it.sku ?? "—",
        ten: it.ten_hien_thi ?? "—",
        sl: 0,
        doanhThu: 0,
        von: 0,
      };
      cur.sl += it.so_luong;
      cur.doanhThu += tienDongHang(it);
      cur.von += (costByItem.get(it.id) ?? 0) * it.so_luong;
      m.set(k, cur);
    }

    return [...m.values()]
      .map((r) => ({ ...r, lai: r.doanhThu - r.von }))
      .sort((a, b) => b.lai - a.lai);
  }, [orders, items, costByItem]);

  const theoTrangThai = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.trang_thai, (m.get(o.trang_thai) ?? 0) + 1);
    return TRANG_THAI_LIST.map((t) => ({ t, n: m.get(t) ?? 0 })).filter((r) => r.n > 0);
  }, [orders]);

  const theoStore = useMemo(
    () =>
      gopDoanhThu(orders, (o) => o.store_id)
        .map((r) => ({ ten: storeNames[r.label] ?? "—", ...r }))
        .sort((a, b) => b.doanhThu - a.doanhThu),
    [orders, storeNames],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Báo cáo</h1>
          <p className="text-sm text-dark/60">
            {tu} → {den} · {orders.length} đơn
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input w-auto"
            value={tuLocal}
            onChange={(e) => setTuLocal(e.target.value)}
          />
          <span className="text-dark/40">→</span>
          <input
            type="date"
            className="input w-auto"
            value={denLocal}
            onChange={(e) => setDenLocal(e.target.value)}
          />
          <button
            className="btn-ghost"
            onClick={() => router.push(`/sales/reports?tu=${tuLocal}&den=${denLocal}`)}
          >
            Xem
          </button>
          <button
            className="btn-dark"
            onClick={() =>
              xuatBaoCaoThang({
                thang: `${tu}_${den}`,
                orders,
                items,
                storeNames,
                costByItem,
              })
            }
          >
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Doanh thu" value={formatVND(stats.doanhThu)} sub={`${stats.soDon} đơn`} accent />
        <StatCard
          label="Lợi nhuận gộp"
          value={formatVND(stats.loiNhuan)}
          sub={stats.tienHang ? `Biên ${Math.round((stats.loiNhuan / stats.tienHang) * 100)}%` : "—"}
        />
        <StatCard label="Giá vốn hàng bán" value={formatVND(stats.giaVon)} />
        <StatCard label="COD chưa thu" value={formatVND(stats.congNoCod)} sub="Đơn đang giao" />
      </div>

      <div className="card">
        <h2 className="mb-4 font-display font-extrabold">Doanh thu theo ngày</h2>
        <ColumnChart data={theoNgay} />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-display font-extrabold">Hiệu quả từng kênh</h2>
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">Kênh</th>
              <th className="th text-right">Đơn</th>
              <th className="th text-right">Doanh thu</th>
              <th className="th text-right">Tiền hàng</th>
              <th className="th text-right">Giá vốn</th>
              <th className="th text-right">Lãi gộp</th>
              <th className="th text-right">Biên</th>
            </tr>
          </thead>
          <tbody>
            {theoKenh.map((r) => (
              <tr key={r.kenh} className="border-b border-dark/5">
                <td className="td font-medium">{KENH_LABEL[r.kenh] ?? r.kenh}</td>
                <td className="td text-right">{r.soDon}</td>
                <td className="td text-right font-semibold">{formatVND(r.doanhThu)}</td>
                <td className="td text-right text-dark/70">{formatVND(r.tienHang)}</td>
                <td className="td text-right text-dark/70">{formatVND(r.giaVon)}</td>
                <td className={`td text-right font-semibold ${r.lai < 0 ? "text-warning" : ""}`}>
                  {formatVND(r.lai)}
                </td>
                <td className="td text-right">{r.bien}%</td>
              </tr>
            ))}
            {theoKenh.length === 0 && (
              <tr>
                <td className="td" colSpan={7}>
                  <Empty>Chưa có đơn hoàn thành trong kỳ</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-display font-extrabold">Theo cửa hàng / kho</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark/10">
                <th className="th">Nơi bán</th>
                <th className="th text-right">Đơn</th>
                <th className="th text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {theoStore.map((r) => (
                <tr key={r.label} className="border-b border-dark/5">
                  <td className="td">{r.ten}</td>
                  <td className="td text-right">{r.soDon}</td>
                  <td className="td text-right font-semibold">{formatVND(r.doanhThu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="mb-3 font-display font-extrabold">Trạng thái đơn trong kỳ</h2>
          <ul className="space-y-2">
            {theoTrangThai.map((r) => (
              <li key={r.t} className="flex items-center justify-between text-sm">
                <span>{TRANG_THAI_LABEL[r.t]}</span>
                <span className="font-semibold">{r.n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-display font-extrabold">Lãi gộp theo SKU</h2>
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-dark/10">
              <th className="th">SKU</th>
              <th className="th">Sản phẩm</th>
              <th className="th text-right">SL bán</th>
              <th className="th text-right">Doanh thu</th>
              <th className="th text-right">Giá vốn</th>
              <th className="th text-right">Lãi gộp</th>
            </tr>
          </thead>
          <tbody>
            {theoSku.slice(0, 50).map((r) => (
              <tr key={r.sku} className="border-b border-dark/5">
                <td className="td font-mono text-xs">{r.sku}</td>
                <td className="td max-w-[260px] truncate">{r.ten}</td>
                <td className="td text-right">{r.sl}</td>
                <td className="td text-right">{formatVND(r.doanhThu)}</td>
                <td className="td text-right text-dark/70">{formatVND(r.von)}</td>
                <td className={`td text-right font-semibold ${r.lai < 0 ? "text-warning" : ""}`}>
                  {formatVND(r.lai)}
                </td>
              </tr>
            ))}
            {theoSku.length === 0 && (
              <tr>
                <td className="td" colSpan={6}>
                  <Empty>Chưa có dữ liệu</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
