"use client";

import { useEffect, useMemo } from "react";
import { formatNgayGio, formatVND, tienDongHang } from "@/lib/sales/calc";
import { KENH_LABEL, THANH_TOAN_LABEL } from "@/lib/sales/constants";
import type { Order, OrderItem, Store } from "@/lib/sales/types";

export default function PrintClient({
  kieu,
  orders,
  items,
  stores,
}: {
  kieu: "phieu" | "hoadon";
  orders: Order[];
  items: OrderItem[];
  stores: Store[];
}) {
  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const it of items) {
      if (!m.has(it.order_id)) m.set(it.order_id, []);
      m.get(it.order_id)!.push(it);
    }
    return m;
  }, [items]);

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  // Tự mở hộp thoại in khi trang đã render xong
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="no-print sticky top-0 flex items-center justify-between border-b border-dark/10 bg-paper px-4 py-3">
        <span className="text-sm font-semibold">
          {orders.length} {kieu === "hoadon" ? "hoá đơn" : "phiếu giao hàng"}
        </span>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => window.close()}>
            Đóng
          </button>
          <button className="btn-dark" onClick={() => window.print()}>
            In
          </button>
        </div>
      </div>

      {orders.map((o) =>
        kieu === "hoadon" ? (
          <HoaDon
            key={o.id}
            order={o}
            items={itemsByOrder.get(o.id) ?? []}
            store={storeById.get(o.store_id) ?? null}
          />
        ) : (
          <PhieuGiao
            key={o.id}
            order={o}
            items={itemsByOrder.get(o.id) ?? []}
            store={storeById.get(o.store_id) ?? null}
          />
        ),
      )}
    </div>
  );
}

/** Phiếu giao hàng khổ A5 — dán lên kiện hàng. */
function PhieuGiao({
  order,
  items,
  store,
}: {
  order: Order;
  items: OrderItem[];
  store: Store | null;
}) {
  const thuHo = order.thanh_toan === "cod" ? order.tong_tien : 0;

  return (
    <section className="print-page mx-auto my-4 w-[148mm] border border-dark/20 p-5 text-[11px] leading-snug">
      <header className="flex items-start justify-between border-b-2 border-dark pb-2">
        <div>
          <div className="font-display text-lg font-extrabold">AESCENTIC</div>
          <div className="text-dark/70">{store?.ten}</div>
          {store?.dia_chi && <div className="text-dark/60">{store.dia_chi}</div>}
          {store?.sdt && <div className="text-dark/60">ĐT: {store.sdt}</div>}
        </div>
        <div className="text-right">
          <div className="font-mono text-base font-extrabold">{order.ma_don}</div>
          <div className="text-dark/60">{formatNgayGio(order.ngay_dat)}</div>
          <div className="text-dark/60">{KENH_LABEL[order.kenh] ?? order.kenh}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 border-b border-dark/20 py-3">
        <div>
          <div className="mb-1 font-bold uppercase tracking-wide text-dark/50">Người nhận</div>
          <div className="text-sm font-bold">{order.khach_ten || "—"}</div>
          <div className="font-mono">{order.khach_sdt || "—"}</div>
          <div className="mt-1">{order.dia_chi || "—"}</div>
        </div>
        <div>
          <div className="mb-1 font-bold uppercase tracking-wide text-dark/50">Vận chuyển</div>
          <div>{order.don_vi_van_chuyen || "—"}</div>
          {order.ma_van_don && (
            <div className="mt-1 font-mono text-base font-extrabold tracking-wider">
              {order.ma_van_don}
            </div>
          )}
          {order.ma_don_san && <div className="text-dark/60">Mã sàn: {order.ma_don_san}</div>}
        </div>
      </div>

      <table className="w-full border-collapse py-2">
        <thead>
          <tr className="border-b border-dark/30 text-left">
            <th className="py-1 font-bold uppercase text-dark/50">Sản phẩm</th>
            <th className="py-1 text-center font-bold uppercase text-dark/50">SL</th>
            <th className="py-1 text-right font-bold uppercase text-dark/50">Đơn giá</th>
            <th className="py-1 text-right font-bold uppercase text-dark/50">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-dark/10">
              <td className="py-1">
                {it.ten_hien_thi}
                <span className="ml-1 font-mono text-[10px] text-dark/50">{it.sku}</span>
              </td>
              <td className="py-1 text-center font-bold">{it.so_luong}</td>
              <td className="py-1 text-right">{formatVND(it.don_gia)}</td>
              <td className="py-1 text-right">{formatVND(tienDongHang(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-2 w-1/2 space-y-0.5">
        <Row label="Tiền hàng" value={formatVND(order.tam_tinh)} />
        {order.giam_gia > 0 && <Row label="Giảm giá" value={`−${formatVND(order.giam_gia)}`} />}
        {order.phi_ship > 0 && <Row label="Phí ship" value={`+${formatVND(order.phi_ship)}`} />}
        <div className="flex justify-between border-t border-dark pt-1 text-sm font-extrabold">
          <span>Tổng cộng</span>
          <span>{formatVND(order.tong_tien)}</span>
        </div>
        {/* Ô shipper nhìn vào: chỉ hiện số tiền khi thật sự phải thu */}
        <div className="flex justify-between bg-dark px-2 py-1 text-sm font-extrabold text-white">
          {thuHo > 0 ? (
            <>
              <span>THU HỘ (COD)</span>
              <span>{formatVND(thuHo)}</span>
            </>
          ) : (
            <>
              <span>{THANH_TOAN_LABEL[order.thanh_toan]}</span>
              <span>KHÔNG THU TIỀN</span>
            </>
          )}
        </div>
      </div>

      {order.ghi_chu && (
        <p className="mt-2 border-t border-dark/20 pt-2">
          <span className="font-bold">Ghi chú:</span> {order.ghi_chu}
        </p>
      )}

      <footer className="mt-3 flex justify-between border-t border-dark/20 pt-2 text-[10px] text-dark/50">
        <span>Kiểm tra hàng trước khi thanh toán. Đổi trả trong 7 ngày nếu còn nguyên seal.</span>
        <span>aescentic.vn</span>
      </footer>
    </section>
  );
}

/** Hoá đơn bán lẻ khổ 80mm — máy in nhiệt tại quầy. */
function HoaDon({
  order,
  items,
  store,
}: {
  order: Order;
  items: OrderItem[];
  store: Store | null;
}) {
  return (
    <section className="print-page mx-auto my-4 w-[76mm] p-2 font-mono text-[10px] leading-tight">
      <div className="text-center">
        <div className="font-display text-base font-extrabold">AESCENTIC</div>
        <div>{store?.ten}</div>
        {store?.dia_chi && <div>{store.dia_chi}</div>}
        {store?.sdt && <div>ĐT: {store.sdt}</div>}
      </div>

      <div className="my-2 border-y border-dashed border-dark/40 py-1">
        <div className="flex justify-between">
          <span>Đơn</span>
          <span className="font-bold">{order.ma_don}</span>
        </div>
        <div className="flex justify-between">
          <span>Ngày</span>
          <span>{formatNgayGio(order.ngay_dat)}</span>
        </div>
        {order.khach_sdt && (
          <div className="flex justify-between">
            <span>Khách</span>
            <span>{order.khach_ten || order.khach_sdt}</span>
          </div>
        )}
      </div>

      {items.map((it) => (
        <div key={it.id} className="mb-1">
          <div>{it.ten_hien_thi}</div>
          <div className="flex justify-between">
            <span>
              {it.so_luong} × {formatVND(it.don_gia)}
            </span>
            <span>{formatVND(tienDongHang(it))}</span>
          </div>
        </div>
      ))}

      <div className="mt-2 border-t border-dashed border-dark/40 pt-1">
        <Row label="Tiền hàng" value={formatVND(order.tam_tinh)} />
        {order.giam_gia > 0 && <Row label="Giảm giá" value={`−${formatVND(order.giam_gia)}`} />}
        {order.phi_ship > 0 && <Row label="Phí ship" value={`+${formatVND(order.phi_ship)}`} />}
        <div className="flex justify-between text-xs font-extrabold">
          <span>TỔNG</span>
          <span>{formatVND(order.tong_tien)}</span>
        </div>
        <Row label="Thanh toán" value={THANH_TOAN_LABEL[order.thanh_toan]} />
      </div>

      <p className="mt-3 text-center">Cảm ơn bạn đã chọn Aescentic!</p>
      <p className="text-center">aescentic.vn</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-dark/60">{label}</span>
      <span>{value}</span>
    </div>
  );
}
