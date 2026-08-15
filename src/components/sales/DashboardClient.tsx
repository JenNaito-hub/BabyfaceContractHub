"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ColumnChart, RankBar } from "@/components/sales/SalesCharts";
import { StatCard, Empty } from "@/components/sales/Bits";
import {
  doanhThuTheoNgay,
  formatVND,
  formatThang,
  gopDoanhThu,
  khoangThang,
  tinhThongKe,
  topSanPham,
} from "@/lib/sales/calc";
import { KENH_COLOR, KENH_LABEL, KENH_LIST } from "@/lib/sales/constants";
import { xuatBaoCaoThang } from "@/lib/sales/excel";
import type {
  InventoryRow,
  Kenh,
  Order,
  OrderItem,
  OrderItemCost,
  Store,
  VariantFull,
} from "@/lib/sales/types";

export default function DashboardClient({
  thang,
  isManager,
  stores,
  orders,
  items,
  costs,
  variants,
  inventory,
}: {
  thang: string;
  isManager: boolean;
  stores: Store[];
  orders: Order[];
  items: OrderItem[];
  costs: OrderItemCost[];
  variants: VariantFull[];
  inventory: InventoryRow[];
}) {
  const router = useRouter();
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [kenhFilter, setKenhFilter] = useState<Kenh | "all">("all");

  const storeNames = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s.ten])) as Record<string, string>,
    [stores],
  );

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (storeFilter === "all" || o.store_id === storeFilter) &&
          (kenhFilter === "all" || o.kenh === kenhFilter),
      ),
    [orders, storeFilter, kenhFilter],
  );

  const filteredIds = useMemo(() => new Set(filtered.map((o) => o.id)), [filtered]);
  const filteredItems = useMemo(
    () => items.filter((it) => filteredIds.has(it.order_id)),
    [items, filteredIds],
  );

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const it of filteredItems) {
      if (!m.has(it.order_id)) m.set(it.order_id, []);
      m.get(it.order_id)!.push(it);
    }
    return m;
  }, [filteredItems]);

  const costByItem = useMemo(
    () => (isManager ? new Map(costs.map((c) => [c.order_item_id, c.gia_von])) : undefined),
    [costs, isManager],
  );

  const stats = useMemo(
    () => tinhThongKe(filtered, itemsByOrder, costByItem),
    [filtered, itemsByOrder, costByItem],
  );

  const theoNgay = useMemo(() => {
    const { tu, den } = khoangThang(thang);
    return doanhThuTheoNgay(filtered, new Date(tu), new Date(den));
  }, [filtered, thang]);

  const theoKenh = useMemo(
    () =>
      gopDoanhThu(filtered, (o) => o.kenh)
        .map((r) => ({
          label: KENH_LABEL[r.label] ?? r.label,
          value: r.doanhThu,
          color: KENH_COLOR[r.label],
        }))
        .sort((a, b) => b.value - a.value),
    [filtered],
  );

  const theoStore = useMemo(
    () =>
      gopDoanhThu(filtered, (o) => o.store_id)
        .map((r) => ({ label: storeNames[r.label] ?? "—", value: r.doanhThu }))
        .sort((a, b) => b.value - a.value),
    [filtered, storeNames],
  );

  const top = useMemo(() => topSanPham(filtered, filteredItems, 8), [filtered, filteredItems]);

  const canXuLy = useMemo(
    () => filtered.filter((o) => o.trang_thai === "moi" || o.trang_thai === "da_xac_nhan").length,
    [filtered],
  );

  const sapHet = useMemo(() => {
    const tong = new Map<string, number>();
    for (const row of inventory) {
      if (storeFilter !== "all" && row.store_id !== storeFilter) continue;
      tong.set(row.variant_id, (tong.get(row.variant_id) ?? 0) + row.so_luong);
    }
    return variants
      .map((v) => ({ v, ton: tong.get(v.id) ?? 0 }))
      .filter((r) => r.ton <= r.v.ton_toi_thieu)
      .sort((a, b) => a.ton - b.ton)
      .slice(0, 8);
  }, [inventory, variants, storeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Tổng quan</h1>
          <p className="text-sm text-dark/60">{formatThang(thang)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            className="input w-auto"
            value={thang}
            onChange={(e) => router.push(`/sales?thang=${e.target.value}`)}
          />
          <select
            className="input w-auto"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
          >
            <option value="all">Tất cả cửa hàng</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ten}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={kenhFilter}
            onChange={(e) => setKenhFilter(e.target.value as Kenh | "all")}
          >
            <option value="all">Tất cả kênh</option>
            {KENH_LIST.map((k) => (
              <option key={k} value={k}>
                {KENH_LABEL[k]}
              </option>
            ))}
          </select>
          <button
            className="btn-dark"
            onClick={() =>
              xuatBaoCaoThang({
                thang,
                orders: filtered,
                items: filteredItems,
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
        <StatCard label="Doanh thu" value={formatVND(stats.doanhThu)} sub={`${stats.soDon} đơn hoàn thành`} accent />
        {isManager && (
          <StatCard
            label="Lợi nhuận gộp"
            value={formatVND(stats.loiNhuan)}
            sub={
              stats.tienHang
                ? `Biên ${Math.round((stats.loiNhuan / stats.tienHang) * 100)}% · vốn ${formatVND(stats.giaVon)}`
                : "—"
            }
          />
        )}
        <StatCard label="Giá trị đơn TB" value={formatVND(stats.giaTriTB)} sub={`${stats.soSanPham} sản phẩm bán ra`} />
        <StatCard
          label="Cần xử lý"
          value={canXuLy}
          sub={`${stats.donHuy} đơn huỷ/hoàn trong kỳ`}
        />
        {!isManager && (
          <StatCard label="COD đang giao" value={formatVND(stats.congNoCod)} sub="Chưa thu về" />
        )}
      </div>

      {isManager && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="COD đang trên đường" value={formatVND(stats.congNoCod)} sub="Chưa thu về" />
          <StatCard label="Tiền hàng" value={formatVND(stats.tienHang)} sub="Chưa gồm ship & giảm giá" />
          <StatCard label="Tổng đơn trong kỳ" value={orders.length} sub="Mọi trạng thái" />
          <StatCard label="Sắp hết hàng" value={sapHet.length} sub="SKU dưới ngưỡng tồn" />
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 font-display font-extrabold">Doanh thu theo ngày</h2>
        <ColumnChart data={theoNgay} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-display font-extrabold">Theo kênh bán</h2>
          <RankBar data={theoKenh} />
        </div>
        <div className="card">
          <h2 className="mb-4 font-display font-extrabold">Theo cửa hàng / kho</h2>
          <RankBar data={theoStore} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-display font-extrabold">Bán chạy nhất</h2>
          {top.length === 0 ? (
            <Empty>Chưa có đơn hoàn thành</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">SKU</th>
                  <th className="th">Sản phẩm</th>
                  <th className="th text-right">SL</th>
                  <th className="th text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.sku} className="border-b border-dark/5">
                    <td className="td font-mono text-xs">{r.sku}</td>
                    <td className="td max-w-[200px] truncate">{r.ten}</td>
                    <td className="td text-right font-semibold">{r.soLuong}</td>
                    <td className="td text-right">{formatVND(r.doanhThu)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-extrabold">Sắp hết hàng</h2>
            <Link href="/sales/inventory" className="text-xs font-semibold text-dark/60 underline">
              Xem kho
            </Link>
          </div>
          {sapHet.length === 0 ? (
            <Empty>Tồn kho đang ổn</Empty>
          ) : (
            <ul className="divide-y divide-dark/5">
              {sapHet.map(({ v, ton }) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {v.product?.ten} — {v.ten_bien_the}
                    </div>
                    <div className="font-mono text-xs text-dark/50">{v.sku}</div>
                  </div>
                  <span
                    className={`badge ${ton <= 0 ? "bg-warning text-white" : "bg-amber-100 text-amber-800"}`}
                  >
                    Còn {ton} / ngưỡng {v.ton_toi_thieu}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
