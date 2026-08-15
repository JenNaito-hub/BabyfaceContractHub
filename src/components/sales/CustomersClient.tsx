"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { Empty, KenhBadge, StatCard } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { chuanHoaSdt, formatNgay, formatVND, laDoanhThu } from "@/lib/sales/calc";
import { NHOM_KHACH_LABEL, NHOM_KHACH_LIST } from "@/lib/sales/constants";
import type { Customer, NhomKhach, Order } from "@/lib/sales/types";

type OrderLite = Pick<
  Order,
  "id" | "customer_id" | "tong_tien" | "trang_thai" | "ngay_dat" | "ma_don" | "kenh"
>;

export default function CustomersClient({
  customers,
  orders,
  isManager,
}: {
  customers: Customer[];
  orders: OrderLite[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [nhom, setNhom] = useState<NhomKhach | "all">("all");
  const [form, setForm] = useState<Partial<Customer> | null>(null);
  const [xem, setXem] = useState<Customer | null>(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const thongKe = useMemo(() => {
    const m = new Map<string, { soDon: number; tong: number; lanCuoi: string | null }>();
    for (const o of orders) {
      if (!o.customer_id) continue;
      const cur = m.get(o.customer_id) ?? { soDon: 0, tong: 0, lanCuoi: null };
      if (laDoanhThu(o.trang_thai)) {
        cur.soDon += 1;
        cur.tong += Number(o.tong_tien);
      }
      if (!cur.lanCuoi || o.ngay_dat > cur.lanCuoi) cur.lanCuoi = o.ngay_dat;
      m.set(o.customer_id, cur);
    }
    return m;
  }, [orders]);

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (nhom !== "all" && c.nhom !== nhom) return false;
        if (!key) return true;
        return (
          c.ho_ten.toLowerCase().includes(key) ||
          (c.sdt ?? "").includes(key) ||
          (c.email ?? "").toLowerCase().includes(key)
        );
      })
      .sort((a, b) => (thongKe.get(b.id)?.tong ?? 0) - (thongKe.get(a.id)?.tong ?? 0));
  }, [customers, q, nhom, thongKe]);

  const donCuaKhach = useMemo(
    () => (xem ? orders.filter((o) => o.customer_id === xem.id) : []),
    [orders, xem],
  );

  const khachQuayLai = useMemo(
    () => [...thongKe.values()].filter((v) => v.soDon >= 2).length,
    [thongKe],
  );

  async function luu() {
    if (!form?.ho_ten?.trim()) return;
    setDangLuu(true);
    setLoi(null);
    const supabase = createClient();
    const payload = {
      ho_ten: form.ho_ten.trim(),
      sdt: chuanHoaSdt(form.sdt) || null,
      email: form.email || null,
      dia_chi: form.dia_chi || null,
      nhom: form.nhom ?? "le",
      ghi_chu: form.ghi_chu || null,
    };
    const { error } = form.id
      ? await supabase.from("customers").update(payload).eq("id", form.id)
      : await supabase.from("customers").insert(payload);
    setDangLuu(false);
    if (error) return setLoi(error.message);
    setForm(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Khách hàng</h1>
          <p className="text-sm text-dark/60">
            Khách được tạo tự động theo SĐT mỗi khi chốt đơn.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ho_ten: "", nhom: "le" })}>
          + Khách hàng
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tổng khách" value={customers.length} />
        <StatCard label="Khách mua lại" value={khachQuayLai} sub="Từ 2 đơn trở lên" />
        <StatCard
          label="Khách sỉ / VIP"
          value={customers.filter((c) => c.nhom !== "le").length}
        />
      </div>

      <div className="card flex flex-wrap gap-2">
        <input
          className="input flex-1"
          placeholder="Tìm tên, SĐT, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input w-auto"
          value={nhom}
          onChange={(e) => setNhom(e.target.value as NhomKhach | "all")}
        >
          <option value="all">Mọi nhóm</option>
          {NHOM_KHACH_LIST.map((n) => (
            <option key={n} value={n}>
              {NHOM_KHACH_LABEL[n]}
            </option>
          ))}
        </select>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="card overflow-x-auto p-0">
        {ketQua.length === 0 ? (
          <Empty>Chưa có khách hàng nào</Empty>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-dark/10">
                <th className="th">Khách</th>
                <th className="th">Nhóm</th>
                <th className="th text-right">Số đơn</th>
                <th className="th text-right">Tổng chi tiêu</th>
                <th className="th">Mua gần nhất</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {ketQua.slice(0, 300).map((c) => {
                const tk = thongKe.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-dark/5 hover:bg-dark/[0.02]">
                    <td className="td">
                      <button className="text-left" onClick={() => setXem(c)}>
                        <div className="font-semibold underline">{c.ho_ten}</div>
                        <div className="text-xs text-dark/50">{c.sdt ?? "—"}</div>
                      </button>
                    </td>
                    <td className="td">
                      <span
                        className={`badge ${
                          c.nhom === "vip"
                            ? "bg-lime text-dark"
                            : c.nhom === "si"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-dark/5 text-dark/60"
                        }`}
                      >
                        {NHOM_KHACH_LABEL[c.nhom]}
                      </span>
                    </td>
                    <td className="td text-right">{tk?.soDon ?? 0}</td>
                    <td className="td text-right font-semibold">{formatVND(tk?.tong ?? 0)}</td>
                    <td className="td text-dark/60">{formatNgay(tk?.lanCuoi)}</td>
                    <td className="td text-right">
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setForm(c)}>
                        Sửa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? "Sửa khách hàng" : "Thêm khách hàng"}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setForm(null)}>
                Huỷ
              </button>
              <button className="btn-primary" onClick={luu} disabled={dangLuu}>
                Lưu
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Họ tên *</label>
              <input
                className="input"
                value={form.ho_ten ?? ""}
                onChange={(e) => setForm({ ...form, ho_ten: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">SĐT</label>
                <input
                  className="input"
                  value={form.sdt ?? ""}
                  onChange={(e) => setForm({ ...form, sdt: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Nhóm</label>
                <select
                  className="input"
                  value={form.nhom ?? "le"}
                  onChange={(e) => setForm({ ...form, nhom: e.target.value as NhomKhach })}
                >
                  {NHOM_KHACH_LIST.map((n) => (
                    <option key={n} value={n}>
                      {NHOM_KHACH_LABEL[n]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Địa chỉ</label>
              <input
                className="input"
                value={form.dia_chi ?? ""}
                onChange={(e) => setForm({ ...form, dia_chi: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ghi chú chăm sóc</label>
              <textarea
                className="input h-20"
                value={form.ghi_chu ?? ""}
                onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
                placeholder="Thích mùi gỗ ấm, hay mua dịp lễ…"
              />
            </div>
          </div>
        </Modal>
      )}

      {xem && (
        <Modal title={xem.ho_ten} onClose={() => setXem(null)} size="lg">
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-dark/50">SĐT:</span> {xem.sdt ?? "—"}
              </div>
              <div>
                <span className="text-dark/50">Nhóm:</span> {NHOM_KHACH_LABEL[xem.nhom]}
              </div>
              <div className="sm:col-span-2">
                <span className="text-dark/50">Địa chỉ:</span> {xem.dia_chi ?? "—"}
              </div>
              {xem.ghi_chu && (
                <div className="sm:col-span-2">
                  <span className="text-dark/50">Ghi chú:</span> {xem.ghi_chu}
                </div>
              )}
              {isManager && (
                <div className="sm:col-span-2 font-semibold">
                  Tổng chi tiêu: {formatVND(thongKe.get(xem.id)?.tong ?? 0)} ·{" "}
                  {thongKe.get(xem.id)?.soDon ?? 0} đơn
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-display font-extrabold">Lịch sử mua</h3>
              {donCuaKhach.length === 0 ? (
                <Empty>Chưa có đơn nào</Empty>
              ) : (
                <ul className="divide-y divide-dark/5">
                  {donCuaKhach.slice(0, 20).map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Link href={`/sales/orders/${o.id}`} className="font-semibold underline">
                          {o.ma_don}
                        </Link>
                        <KenhBadge kenh={o.kenh} />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatVND(o.tong_tien)}</div>
                        <div className="text-xs text-dark/50">{formatNgay(o.ngay_dat)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
