"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { KenhBadge, ThanhToanBadge, TrangThaiBadge } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatNgayGio, formatVND, tienDongHang } from "@/lib/sales/calc";
import { TINH_THANH } from "@/lib/sales/address";
import {
  DON_VI_VAN_CHUYEN,
  THANH_TOAN_LABEL,
  THANH_TOAN_LIST,
  TRANG_THAI_LABEL,
  TRANG_THAI_LIST,
} from "@/lib/sales/constants";
import type {
  InventoryRow,
  Order,
  OrderItem,
  OrderItemCost,
  Store,
  TrangThaiDon,
  TrangThaiThanhToan,
  VariantFull,
} from "@/lib/sales/types";

export default function OrderDetailClient({
  order,
  items,
  stores,
  variants,
  inventory,
  costs,
  isManager,
}: {
  order: Order;
  items: OrderItem[];
  stores: Store[];
  variants: VariantFull[];
  inventory: InventoryRow[];
  costs: OrderItemCost[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [loi, setLoi] = useState<string | null>(null);
  const [tinNhan, setTinNhan] = useState<string | null>(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [q, setQ] = useState("");

  const [form, setForm] = useState({
    khach_ten: order.khach_ten ?? "",
    khach_sdt: order.khach_sdt ?? "",
    dia_chi: order.dia_chi ?? "",
    tinh: order.tinh ?? "",
    quan: order.quan ?? "",
    phuong: order.phuong ?? "",
    don_vi_van_chuyen: order.don_vi_van_chuyen ?? "",
    ma_van_don: order.ma_van_don ?? "",
    phi_ship: order.phi_ship,
    giam_gia: order.giam_gia,
    thanh_toan: order.thanh_toan,
    ghi_chu: order.ghi_chu ?? "",
  });

  const store = stores.find((s) => s.id === order.store_id);
  const khoa = order.da_tru_kho; // đã trừ kho → không cho sửa dòng hàng
  const costByItem = useMemo(
    () => new Map(costs.map((c) => [c.order_item_id, c.gia_von])),
    [costs],
  );

  const tonKho = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(`${r.variant_id}:${order.store_id}`, r.so_luong);
    return m;
  }, [inventory, order.store_id]);

  const goiY = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return [];
    return variants
      .filter(
        (v) =>
          v.sku.toLowerCase().includes(key) ||
          (v.ten_bien_the ?? "").toLowerCase().includes(key) ||
          (v.product?.ten ?? "").toLowerCase().includes(key),
      )
      .slice(0, 6);
  }, [q, variants]);

  const tienVon = items.reduce((s, it) => s + (costByItem.get(it.id) ?? 0) * it.so_luong, 0);
  const laiGop = order.tam_tinh - tienVon;

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

  async function doiTrangThai(next: TrangThaiDon) {
    const supabase = createClient();
    await chay(() => supabase.from("orders").update({ trang_thai: next }).eq("id", order.id));
  }

  async function luuThongTin() {
    const supabase = createClient();
    await chay(() =>
      supabase
        .from("orders")
        .update({
          khach_ten: form.khach_ten || null,
          khach_sdt: form.khach_sdt || null,
          dia_chi: form.dia_chi || null,
          tinh: form.tinh || null,
          quan: form.quan || null,
          phuong: form.phuong || null,
          don_vi_van_chuyen: form.don_vi_van_chuyen || null,
          ma_van_don: form.ma_van_don || null,
          phi_ship: form.phi_ship,
          giam_gia: form.giam_gia,
          thanh_toan: form.thanh_toan,
          ghi_chu: form.ghi_chu || null,
        })
        .eq("id", order.id),
    );
  }

  async function themHang(v: VariantFull) {
    setQ("");
    const supabase = createClient();
    await chay(() =>
      supabase.from("order_items").insert({
        order_id: order.id,
        variant_id: v.id,
        sku: v.sku,
        ten_hien_thi: `${v.product?.ten ?? ""} ${v.ten_bien_the ?? ""}`.trim(),
        so_luong: 1,
        don_gia: v.gia_ban,
      }),
    );
  }

  async function suaHang(item: OrderItem, patch: Partial<OrderItem>) {
    const supabase = createClient();
    await chay(() => supabase.from("order_items").update(patch).eq("id", item.id));
  }

  async function xoaHang(item: OrderItem) {
    const supabase = createClient();
    await chay(() => supabase.from("order_items").delete().eq("id", item.id));
  }

  /** Đẩy đơn sang GHTK — server route giữ token, client chỉ nhận kết quả. */
  async function daySangGhtk() {
    setDangLuu(true);
    setLoi(null);
    setTinNhan(null);
    try {
      const res = await fetch("/api/shipping/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const json = (await res.json()) as { error?: string; ma_van_don?: string; phi_ship?: number };
      if (!res.ok) {
        setLoi(json.error ?? "Không tạo được vận đơn");
      } else {
        setTinNhan(
          `Đã tạo vận đơn GHTK ${json.ma_van_don}` +
            (json.phi_ship ? ` · phí ${formatVND(json.phi_ship)}` : ""),
        );
        router.refresh();
      }
    } catch (e) {
      setLoi((e as Error).message);
    }
    setDangLuu(false);
  }

  async function xoaDon() {
    if (!confirm(`Xoá hẳn đơn ${order.ma_don}? Thao tác này không hoàn tác được.`)) return;
    const supabase = createClient();
    const ok = await chay(() => supabase.from("orders").delete().eq("id", order.id));
    if (ok) router.push("/sales/orders");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/sales/orders" className="text-xs font-semibold text-dark/50 underline">
            ← Đơn hàng
          </Link>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold">
            {order.ma_don}
            <KenhBadge kenh={order.kenh} />
          </h1>
          <p className="text-sm text-dark/60">
            {formatNgayGio(order.ngay_dat)} · {store?.ten ?? "—"}
            {order.ma_don_san ? ` · Mã sàn ${order.ma_don_san}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TrangThaiBadge trangThai={order.trang_thai} />
          <ThanhToanBadge tt={order.thanh_toan} />
          <select
            className="input w-auto"
            value={order.trang_thai}
            disabled={dangLuu}
            onChange={(e) => doiTrangThai(e.target.value as TrangThaiDon)}
          >
            {TRANG_THAI_LIST.map((t) => (
              <option key={t} value={t}>
                {TRANG_THAI_LABEL[t]}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost"
            onClick={() => window.open(`/print/orders?ids=${order.id}&kieu=phieu`, "_blank")}
          >
            In phiếu giao
          </button>
          <button
            className="btn-ghost"
            onClick={() => window.open(`/print/orders?ids=${order.id}&kieu=hoadon`, "_blank")}
          >
            In hoá đơn
          </button>
          {isManager && (
            <button className="btn-danger" onClick={xoaDon} disabled={dangLuu}>
              Xoá
            </button>
          )}
        </div>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}
      {tinNhan && (
        <p className="rounded-lg bg-lime/25 px-3 py-2 text-sm font-semibold">{tinNhan}</p>
      )}

      {khoa && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Đơn đã trừ kho. Muốn sửa dòng hàng thì chuyển trạng thái về “Mới” trước — hàng sẽ được
          trả lại kho.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-3 font-display font-extrabold">Sản phẩm</h2>

            <table className="w-full">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">Sản phẩm</th>
                  <th className="th text-center">SL</th>
                  <th className="th text-right">Đơn giá</th>
                  <th className="th text-right">Thành tiền</th>
                  {!khoa && <th className="th" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-dark/5">
                    <td className="td">
                      <div className="font-medium">{it.ten_hien_thi ?? "—"}</div>
                      <div className="font-mono text-[11px] text-dark/40">
                        {it.sku ?? "—"}
                        {!it.variant_id && (
                          <span className="ml-2 text-warning">chưa khớp danh mục</span>
                        )}
                      </div>
                    </td>
                    <td className="td text-center">
                      {khoa ? (
                        it.so_luong
                      ) : (
                        <input
                          className="input w-16 py-1 text-center text-sm"
                          defaultValue={it.so_luong}
                          onBlur={(e) => {
                            const v = Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1);
                            if (v !== it.so_luong) suaHang(it, { so_luong: v });
                          }}
                        />
                      )}
                    </td>
                    <td className="td text-right">
                      {khoa ? (
                        formatVND(it.don_gia)
                      ) : (
                        <input
                          className="input w-28 py-1 text-right text-sm"
                          defaultValue={it.don_gia}
                          onBlur={(e) => {
                            const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                            if (v !== it.don_gia) suaHang(it, { don_gia: v });
                          }}
                        />
                      )}
                    </td>
                    <td className="td text-right font-semibold">{formatVND(tienDongHang(it))}</td>
                    {!khoa && (
                      <td className="td text-right">
                        <button
                          className="text-dark/30 hover:text-warning"
                          onClick={() => xoaHang(it)}
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td className="td text-dark/40" colSpan={5}>
                      Chưa có sản phẩm
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {!khoa && (
              <div className="mt-3">
                <input
                  className="input"
                  placeholder="Thêm sản phẩm — gõ SKU hoặc tên…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {goiY.length > 0 && (
                  <ul className="mt-1 divide-y divide-dark/5 rounded-lg border border-dark/10">
                    {goiY.map((v) => (
                      <li key={v.id}>
                        <button
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-dark/5"
                          onClick={() => themHang(v)}
                        >
                          <span className="truncate">
                            {v.product?.ten} — {v.ten_bien_the}
                            <span className="ml-2 font-mono text-xs text-dark/40">{v.sku}</span>
                          </span>
                          <span className="shrink-0 text-xs text-dark/50">
                            còn {tonKho.get(`${v.id}:${order.store_id}`) ?? 0}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 font-display font-extrabold">Khách hàng & vận chuyển</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Tên khách</label>
                <input
                  className="input"
                  value={form.khach_ten}
                  onChange={(e) => setForm({ ...form, khach_ten: e.target.value })}
                />
              </div>
              <div>
                <label className="label">SĐT</label>
                <input
                  className="input"
                  value={form.khach_sdt}
                  onChange={(e) => setForm({ ...form, khach_sdt: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Địa chỉ</label>
                <input
                  className="input"
                  value={form.dia_chi}
                  onChange={(e) => setForm({ ...form, dia_chi: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tỉnh / Thành</label>
                <input
                  className="input"
                  list="ds-tinh-detail"
                  value={form.tinh}
                  onChange={(e) => setForm({ ...form, tinh: e.target.value })}
                />
                <datalist id="ds-tinh-detail">
                  {TINH_THANH.map((t) => (
                    <option key={t.ten} value={t.ten} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">Quận / Huyện</label>
                <input
                  className="input"
                  value={form.quan}
                  onChange={(e) => setForm({ ...form, quan: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phường / Xã</label>
                <input
                  className="input"
                  value={form.phuong}
                  onChange={(e) => setForm({ ...form, phuong: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Đơn vị vận chuyển</label>
                <select
                  className="input"
                  value={form.don_vi_van_chuyen}
                  onChange={(e) => setForm({ ...form, don_vi_van_chuyen: e.target.value })}
                >
                  <option value="">—</option>
                  {DON_VI_VAN_CHUYEN.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Mã vận đơn</label>
                <input
                  className="input"
                  value={form.ma_van_don}
                  onChange={(e) => setForm({ ...form, ma_van_don: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phí ship</label>
                <input
                  className="input text-right"
                  value={form.phi_ship}
                  onChange={(e) =>
                    setForm({ ...form, phi_ship: Number(e.target.value.replace(/\D/g, "")) || 0 })
                  }
                />
              </div>
              <div>
                <label className="label">Giảm giá</label>
                <input
                  className="input text-right"
                  value={form.giam_gia}
                  onChange={(e) =>
                    setForm({ ...form, giam_gia: Number(e.target.value.replace(/\D/g, "")) || 0 })
                  }
                />
              </div>
              <div>
                <label className="label">Thanh toán</label>
                <select
                  className="input"
                  value={form.thanh_toan}
                  onChange={(e) =>
                    setForm({ ...form, thanh_toan: e.target.value as TrangThaiThanhToan })
                  }
                >
                  {THANH_TOAN_LIST.map((t) => (
                    <option key={t} value={t}>
                      {THANH_TOAN_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Ghi chú</label>
                <input
                  className="input"
                  value={form.ghi_chu}
                  onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-dark mt-3" onClick={luuThongTin} disabled={dangLuu}>
              {dangLuu ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="card">
            <h2 className="mb-3 font-display font-extrabold">Thanh toán</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-dark/60">Tiền hàng</dt>
                <dd>{formatVND(order.tam_tinh)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-dark/60">Giảm giá</dt>
                <dd>−{formatVND(order.giam_gia)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-dark/60">Phí ship</dt>
                <dd>+{formatVND(order.phi_ship)}</dd>
              </div>
              <div className="flex justify-between border-t border-dark/10 pt-2 font-display text-lg font-extrabold">
                <dt>Tổng</dt>
                <dd>{formatVND(order.tong_tien)}</dd>
              </div>
            </dl>

            {isManager && (
              <dl className="mt-3 space-y-1.5 border-t border-dark/10 pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-dark/60">Giá vốn</dt>
                  <dd>{formatVND(tienVon)}</dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt>Lãi gộp</dt>
                  <dd className={laiGop < 0 ? "text-warning" : ""}>{formatVND(laiGop)}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="card text-sm">
            <h2 className="mb-2 font-display font-extrabold">Trạng thái kho</h2>
            <p className={order.da_tru_kho ? "text-dark" : "text-dark/60"}>
              {order.da_tru_kho
                ? `Đã trừ kho tại ${store?.ten ?? "—"}`
                : "Chưa trừ kho — xác nhận đơn để trừ"}
            </p>
          </div>

          <div className="card text-sm">
            <h2 className="mb-2 font-display font-extrabold">Vận chuyển</h2>
            {order.ma_van_don ? (
              <>
                <p className="font-mono text-base font-extrabold">{order.ma_van_don}</p>
                <p className="text-dark/60">{order.don_vi_van_chuyen ?? "—"}</p>
                {order.trang_thai_ship && (
                  <p className="mt-1">
                    {order.trang_thai_ship}
                    {order.ship_cap_nhat_luc && (
                      <span className="block text-xs text-dark/50">
                        cập nhật {formatNgayGio(order.ship_cap_nhat_luc)}
                      </span>
                    )}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-dark/60">Chưa có vận đơn.</p>
                <button className="btn-dark mt-2 w-full" onClick={daySangGhtk} disabled={dangLuu}>
                  {dangLuu ? "Đang gửi…" : "Đẩy sang GHTK"}
                </button>
                <p className="mt-1 text-xs text-dark/50">
                  Cần tỉnh/quận của khách và địa chỉ + SĐT của cửa hàng.
                </p>
              </>
            )}

            {order.thanh_toan === "cod" && (
              <p className="mt-2 border-t border-dark/10 pt-2">
                Thu hộ: <strong>{formatVND(order.tong_tien)}</strong>
                {order.cod_da_thu !== null && (
                  <span className="block text-xs text-dark/50">
                    Đã đối soát {formatVND(order.cod_da_thu)}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
