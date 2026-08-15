"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import OrderForm from "@/components/sales/OrderForm";
import { KenhBadge, ThanhToanBadge, TrangThaiBadge, Empty } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatNgayGio, formatVND } from "@/lib/sales/calc";
import { KENH_LABEL, KENH_LIST, TRANG_THAI_LABEL, TRANG_THAI_LIST } from "@/lib/sales/constants";
import type { InventoryRow, Kenh, Order, Store, TrangThaiDon, VariantFull } from "@/lib/sales/types";

export default function OrdersClient({
  orders,
  stores,
  variants,
  inventory,
  defaultStoreId,
  isManager,
}: {
  orders: Order[];
  stores: Store[];
  variants: VariantFull[];
  inventory: InventoryRow[];
  defaultStoreId: string | null;
  isManager: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [kenh, setKenh] = useState<Kenh | "all">("all");
  const [trangThai, setTrangThai] = useState<TrangThaiDon | "all">("all");
  const [storeId, setStoreId] = useState("all");
  const [moForm, setMoForm] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangDoi, setDangDoi] = useState<string | null>(null);

  const storeNames = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s.ten])) as Record<string, string>,
    [stores],
  );

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (kenh !== "all" && o.kenh !== kenh) return false;
      if (trangThai !== "all" && o.trang_thai !== trangThai) return false;
      if (storeId !== "all" && o.store_id !== storeId) return false;
      if (!key) return true;
      return (
        o.ma_don.toLowerCase().includes(key) ||
        (o.khach_ten ?? "").toLowerCase().includes(key) ||
        (o.khach_sdt ?? "").includes(key) ||
        (o.ma_van_don ?? "").toLowerCase().includes(key) ||
        (o.ma_don_san ?? "").toLowerCase().includes(key)
      );
    });
  }, [orders, q, kenh, trangThai, storeId]);

  const tongThu = ketQua
    .filter((o) => o.trang_thai === "hoan_thanh")
    .reduce((s, o) => s + o.tong_tien, 0);

  async function doiTrangThai(order: Order, next: TrangThaiDon) {
    setDangDoi(order.id);
    setLoi(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ trang_thai: next })
      .eq("id", order.id);
    setDangDoi(null);
    if (error) {
      setLoi(`${order.ma_don}: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Đơn hàng</h1>
          <p className="text-sm text-dark/60">
            {ketQua.length} đơn · doanh thu hoàn thành {formatVND(tongThu)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sales/orders/import" className="btn-ghost">
            Nhập file sàn
          </Link>
          <button className="btn-primary" onClick={() => setMoForm(true)}>
            + Tạo đơn
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap gap-2">
        <input
          className="input flex-1"
          placeholder="Tìm mã đơn, tên khách, SĐT, mã vận đơn…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-auto" value={kenh} onChange={(e) => setKenh(e.target.value as Kenh | "all")}>
          <option value="all">Mọi kênh</option>
          {KENH_LIST.map((k) => (
            <option key={k} value={k}>
              {KENH_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={trangThai}
          onChange={(e) => setTrangThai(e.target.value as TrangThaiDon | "all")}
        >
          <option value="all">Mọi trạng thái</option>
          {TRANG_THAI_LIST.map((t) => (
            <option key={t} value={t}>
              {TRANG_THAI_LABEL[t]}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="all">Mọi kho</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ten}
            </option>
          ))}
        </select>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="card overflow-x-auto p-0">
        {ketQua.length === 0 ? (
          <Empty>Không có đơn nào khớp bộ lọc</Empty>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-dark/10">
                <th className="th">Mã đơn</th>
                <th className="th">Ngày</th>
                <th className="th">Kênh</th>
                <th className="th">Khách</th>
                <th className="th">Kho</th>
                <th className="th text-right">Tổng tiền</th>
                <th className="th">Thanh toán</th>
                <th className="th">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {ketQua.slice(0, 200).map((o) => (
                <tr key={o.id} className="border-b border-dark/5 hover:bg-dark/[0.02]">
                  <td className="td">
                    <Link href={`/sales/orders/${o.id}`} className="font-semibold underline">
                      {o.ma_don}
                    </Link>
                    {o.ma_don_san && (
                      <div className="font-mono text-[11px] text-dark/40">{o.ma_don_san}</div>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-dark/70">{formatNgayGio(o.ngay_dat)}</td>
                  <td className="td">
                    <KenhBadge kenh={o.kenh} />
                  </td>
                  <td className="td">
                    <div className="max-w-[180px] truncate">{o.khach_ten || "—"}</div>
                    <div className="text-xs text-dark/50">{o.khach_sdt || ""}</div>
                  </td>
                  <td className="td text-dark/70">{storeNames[o.store_id] ?? "—"}</td>
                  <td className="td text-right font-semibold">{formatVND(o.tong_tien)}</td>
                  <td className="td">
                    <ThanhToanBadge tt={o.thanh_toan} />
                  </td>
                  <td className="td">
                    <select
                      className="rounded-lg border border-dark/15 bg-white px-2 py-1 text-xs font-semibold"
                      value={o.trang_thai}
                      disabled={dangDoi === o.id}
                      onChange={(e) => doiTrangThai(o, e.target.value as TrangThaiDon)}
                    >
                      {TRANG_THAI_LIST.map((t) => (
                        <option key={t} value={t}>
                          {TRANG_THAI_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ketQua.length > 200 && (
        <p className="text-center text-xs text-dark/40">
          Hiển thị 200 đơn đầu — lọc thêm để thu hẹp kết quả.
        </p>
      )}

      {moForm && (
        <Modal title="Tạo đơn hàng" size="lg" onClose={() => setMoForm(false)}>
          <OrderForm
            stores={stores}
            variants={variants}
            inventory={inventory}
            defaultStoreId={defaultStoreId}
            onCancel={() => setMoForm(false)}
            onDone={(id) => {
              setMoForm(false);
              router.push(`/sales/orders/${id}`);
            }}
          />
        </Modal>
      )}

      {!isManager && (
        <p className="text-center text-xs text-dark/40">
          Bạn đang xem ở quyền nhân viên — số liệu giá vốn và lợi nhuận được ẩn.
        </p>
      )}
    </div>
  );
}
