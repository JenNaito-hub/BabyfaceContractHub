"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { chuanHoaSdt, formatVND } from "@/lib/sales/calc";
import {
  DON_VI_VAN_CHUYEN,
  KENH_LABEL,
  KENH_LIST,
  THANH_TOAN_LABEL,
  THANH_TOAN_LIST,
} from "@/lib/sales/constants";
import { tachDiaChi, TINH_THANH } from "@/lib/sales/address";
import type {
  CartLine,
  InventoryRow,
  Kenh,
  Store,
  TrangThaiThanhToan,
  VariantFull,
} from "@/lib/sales/types";

/**
 * Form tạo đơn thủ công — dùng cho đơn chốt qua inbox Facebook/Zalo,
 * đơn website nhập tay và đơn sỉ.
 */
export default function OrderForm({
  stores,
  variants,
  inventory,
  defaultStoreId,
  onDone,
  onCancel,
}: {
  stores: Store[];
  variants: VariantFull[];
  inventory: InventoryRow[];
  defaultStoreId: string | null;
  onDone: (orderId: string) => void;
  onCancel: () => void;
}) {
  const khoOnline = stores.find((s) => s.loai === "warehouse");

  const [kenh, setKenh] = useState<Kenh>("facebook");
  const [storeId, setStoreId] = useState(defaultStoreId ?? khoOnline?.id ?? stores[0]?.id ?? "");
  const [dan, setDan] = useState("");
  const [khachTen, setKhachTen] = useState("");
  const [khachSdt, setKhachSdt] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [tinh, setTinh] = useState("");
  const [quan, setQuan] = useState("");
  const [phuong, setPhuong] = useState("");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [phiShip, setPhiShip] = useState(0);
  const [giamGia, setGiamGia] = useState(0);
  const [thanhToan, setThanhToan] = useState<TrangThaiThanhToan>("cod");
  const [donVi, setDonVi] = useState("");
  const [maVanDon, setMaVanDon] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [xacNhanLuon, setXacNhanLuon] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const tonKho = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(`${r.variant_id}:${r.store_id}`, r.so_luong);
    return m;
  }, [inventory]);
  const ton = (variantId: string) => tonKho.get(`${variantId}:${storeId}`) ?? 0;

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
      .slice(0, 8);
  }, [q, variants]);

  const tamTinh = cart.reduce((s, l) => s + l.so_luong * l.don_gia - l.giam_gia, 0);
  const tongTien = Math.max(0, tamTinh - giamGia + phiShip);

  function themHang(v: VariantFull) {
    setQ("");
    setCart((cur) => {
      const idx = cur.findIndex((l) => l.variant_id === v.id);
      if (idx >= 0) {
        const next = [...cur];
        next[idx] = { ...next[idx], so_luong: next[idx].so_luong + 1 };
        return next;
      }
      return [
        ...cur,
        {
          variant_id: v.id,
          sku: v.sku,
          ten_hien_thi: `${v.product?.ten ?? ""} ${v.ten_bien_the ?? ""}`.trim(),
          so_luong: 1,
          don_gia: v.gia_ban,
          giam_gia: 0,
          ton_kho: ton(v.id),
        },
      ];
    });
  }

  function apDungDan() {
    const t = tachDiaChi(dan);
    if (t.ho_ten) setKhachTen(t.ho_ten);
    if (t.sdt) setKhachSdt(t.sdt);
    if (t.dia_chi) setDiaChi(t.dia_chi);
    if (t.tinh) setTinh(t.tinh);
    if (t.quan) setQuan(t.quan);
  }

  async function luu() {
    if (!cart.length) {
      setLoi("Chưa có sản phẩm nào trong đơn");
      return;
    }
    setDangLuu(true);
    setLoi(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("tao_don_hang", {
      p_order: {
        kenh,
        store_id: storeId,
        khach_ten: khachTen,
        khach_sdt: chuanHoaSdt(khachSdt),
        dia_chi: diaChi,
        tinh,
        quan,
        phuong,
        thanh_toan: thanhToan,
        giam_gia: giamGia,
        phi_ship: phiShip,
        don_vi_van_chuyen: donVi,
        ma_van_don: maVanDon,
        ghi_chu: ghiChu,
      },
      p_items: cart.map((l) => ({
        variant_id: l.variant_id,
        sku: l.sku,
        ten_hien_thi: l.ten_hien_thi,
        so_luong: l.so_luong,
        don_gia: l.don_gia,
        giam_gia: l.giam_gia,
      })),
      p_trang_thai: xacNhanLuon ? "da_xac_nhan" : "moi",
    });

    setDangLuu(false);
    if (error) {
      setLoi(error.message);
      return;
    }
    onDone(data as string);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Kênh bán</label>
          <select className="input" value={kenh} onChange={(e) => setKenh(e.target.value as Kenh)}>
            {KENH_LIST.map((k) => (
              <option key={k} value={k}>
                {KENH_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Trừ kho tại</label>
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ten}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Dán thông tin khách từ inbox</label>
        <textarea
          className="input h-20"
          placeholder={"Nguyễn Thị A\n0901234567\n123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM"}
          value={dan}
          onChange={(e) => setDan(e.target.value)}
          onBlur={apDungDan}
        />
        <button type="button" className="btn-ghost mt-1 text-xs" onClick={apDungDan}>
          Tách tên · SĐT · địa chỉ
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Tên khách</label>
          <input className="input" value={khachTen} onChange={(e) => setKhachTen(e.target.value)} />
        </div>
        <div>
          <label className="label">SĐT</label>
          <input className="input" value={khachSdt} onChange={(e) => setKhachSdt(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Địa chỉ giao</label>
        <input className="input" value={diaChi} onChange={(e) => setDiaChi(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Tỉnh / Thành</label>
          <input
            className="input"
            list="ds-tinh"
            value={tinh}
            onChange={(e) => setTinh(e.target.value)}
            placeholder="TP. Hồ Chí Minh"
          />
          <datalist id="ds-tinh">
            {TINH_THANH.map((t) => (
              <option key={t.ten} value={t.ten} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Quận / Huyện</label>
          <input
            className="input"
            value={quan}
            onChange={(e) => setQuan(e.target.value)}
            placeholder="Quận 1"
          />
        </div>
        <div>
          <label className="label">Phường / Xã</label>
          <input className="input" value={phuong} onChange={(e) => setPhuong(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Thêm sản phẩm</label>
        <input
          className="input"
          placeholder="Gõ SKU hoặc tên nước hoa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {goiY.length > 0 && (
          <ul className="mt-1 divide-y divide-dark/5 rounded-lg border border-dark/10">
            {goiY.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-dark/5"
                  onClick={() => themHang(v)}
                >
                  <span className="min-w-0 truncate">
                    {v.product?.ten} — {v.ten_bien_the}
                    <span className="ml-2 font-mono text-xs text-dark/40">{v.sku}</span>
                  </span>
                  <span className="shrink-0 text-xs text-dark/50">
                    {formatVND(v.gia_ban)} · còn {ton(v.id)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <ul className="divide-y divide-dark/5 rounded-lg border border-dark/10 px-3">
          {cart.map((l) => (
            <li key={l.variant_id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{l.ten_hien_thi}</div>
                <div className="font-mono text-[11px] text-dark/40">
                  {l.sku} · còn {ton(l.variant_id)}
                </div>
              </div>
              <input
                className="input w-16 py-1 text-center text-sm"
                value={l.so_luong}
                onChange={(e) =>
                  setCart((cur) =>
                    cur.map((x) =>
                      x.variant_id === l.variant_id
                        ? { ...x, so_luong: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) }
                        : x,
                    ),
                  )
                }
              />
              <input
                className="input w-28 py-1 text-right text-sm"
                value={l.don_gia}
                onChange={(e) =>
                  setCart((cur) =>
                    cur.map((x) =>
                      x.variant_id === l.variant_id
                        ? { ...x, don_gia: Number(e.target.value.replace(/\D/g, "")) || 0 }
                        : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="text-dark/30 hover:text-warning"
                onClick={() => setCart((cur) => cur.filter((x) => x.variant_id !== l.variant_id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Phí ship</label>
          <input
            className="input text-right"
            value={phiShip}
            onChange={(e) => setPhiShip(Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </div>
        <div>
          <label className="label">Giảm giá</label>
          <input
            className="input text-right"
            value={giamGia}
            onChange={(e) => setGiamGia(Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </div>
        <div>
          <label className="label">Thanh toán</label>
          <select
            className="input"
            value={thanhToan}
            onChange={(e) => setThanhToan(e.target.value as TrangThaiThanhToan)}
          >
            {THANH_TOAN_LIST.map((t) => (
              <option key={t} value={t}>
                {THANH_TOAN_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Đơn vị vận chuyển</label>
          <select className="input" value={donVi} onChange={(e) => setDonVi(e.target.value)}>
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
          <input className="input" value={maVanDon} onChange={(e) => setMaVanDon(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Ghi chú</label>
        <input className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={xacNhanLuon}
          onChange={(e) => setXacNhanLuon(e.target.checked)}
        />
        Xác nhận đơn luôn (trừ kho ngay)
      </label>

      <div className="rounded-xl bg-dark px-4 py-3 text-paper">
        <div className="flex justify-between text-sm">
          <span className="text-paper/60">Tạm tính</span>
          <span>{formatVND(tamTinh)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-paper/60">Ship / giảm</span>
          <span>
            +{formatVND(phiShip)} · −{formatVND(giamGia)}
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between border-t border-paper/20 pt-2">
          <span className="text-sm text-paper/60">Tổng thu</span>
          <span className="font-display text-xl font-extrabold">{formatVND(tongTien)}</span>
        </div>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Huỷ
        </button>
        <button type="button" className="btn-primary" onClick={luu} disabled={dangLuu}>
          {dangLuu ? "Đang lưu…" : "Tạo đơn"}
        </button>
      </div>
    </div>
  );
}
