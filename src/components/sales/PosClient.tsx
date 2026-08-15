"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { chuanHoaSdt, formatVND } from "@/lib/sales/calc";
import { THANH_TOAN_LABEL, THANH_TOAN_LIST } from "@/lib/sales/constants";
import { tachDiaChi } from "@/lib/sales/address";
import type {
  CartLine,
  InventoryRow,
  Store,
  TrangThaiThanhToan,
  VariantFull,
} from "@/lib/sales/types";

export default function PosClient({
  stores,
  variants,
  inventory,
  defaultStoreId,
}: {
  stores: Store[];
  variants: VariantFull[];
  inventory: InventoryRow[];
  defaultStoreId: string | null;
}) {
  const router = useRouter();
  const banLe = stores.filter((s) => s.loai === "store");

  const [storeId, setStoreId] = useState<string>(
    defaultStoreId ?? banLe[0]?.id ?? stores[0]?.id ?? "",
  );
  const [bangGia, setBangGia] = useState<"le" | "si">("le");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [khachTen, setKhachTen] = useState("");
  const [khachSdt, setKhachSdt] = useState("");
  const [giamGia, setGiamGia] = useState(0);
  const [thanhToan, setThanhToan] = useState<TrangThaiThanhToan>("da_thanh_toan");
  const [ghiChu, setGhiChu] = useState("");
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<{ ma_don: string; tong: number } | null>(null);

  const tonKho = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(`${r.variant_id}:${r.store_id}`, r.so_luong);
    return m;
  }, [inventory]);

  const ton = (variantId: string) => tonKho.get(`${variantId}:${storeId}`) ?? 0;
  const gia = (v: VariantFull) => (bangGia === "si" && v.gia_si > 0 ? v.gia_si : v.gia_ban);

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase();
    const list = key
      ? variants.filter(
          (v) =>
            v.sku.toLowerCase().includes(key) ||
            (v.ten_bien_the ?? "").toLowerCase().includes(key) ||
            (v.product?.ten ?? "").toLowerCase().includes(key) ||
            (v.barcode ?? "").toLowerCase().includes(key),
        )
      : variants;
    return list.slice(0, 40);
  }, [q, variants]);

  const tamTinh = cart.reduce((s, l) => s + l.so_luong * l.don_gia - l.giam_gia, 0);
  const tongTien = Math.max(0, tamTinh - giamGia);

  function themVaoGio(v: VariantFull) {
    setLoi(null);
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
          don_gia: gia(v),
          giam_gia: 0,
          ton_kho: ton(v.id),
        },
      ];
    });
  }

  function suaDong(variantId: string, patch: Partial<CartLine>) {
    setCart((cur) =>
      cur.map((l) => (l.variant_id === variantId ? { ...l, ...patch } : l)),
    );
  }

  function xoaDong(variantId: string) {
    setCart((cur) => cur.filter((l) => l.variant_id !== variantId));
  }

  function danThongTin(text: string) {
    const t = tachDiaChi(text);
    if (t.ho_ten) setKhachTen(t.ho_ten);
    if (t.sdt) setKhachSdt(t.sdt);
  }

  const thieuHang = cart.filter((l) => l.so_luong > ton(l.variant_id));

  async function thanhToanDon() {
    if (!cart.length || !storeId) return;
    setDangLuu(true);
    setLoi(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("tao_don_hang", {
      p_order: {
        kenh: "store",
        store_id: storeId,
        khach_ten: khachTen,
        khach_sdt: chuanHoaSdt(khachSdt),
        thanh_toan: thanhToan,
        giam_gia: giamGia,
        phi_ship: 0,
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
      p_trang_thai: "hoan_thanh",
    });

    setDangLuu(false);

    if (error) {
      setLoi(error.message);
      return;
    }

    const { data: don } = await supabase
      .from("orders")
      .select("ma_don, tong_tien")
      .eq("id", data as string)
      .maybeSingle();

    setXong({ ma_don: don?.ma_don ?? "—", tong: don?.tong_tien ?? tongTien });
    setCart([]);
    setKhachTen("");
    setKhachSdt("");
    setGiamGia(0);
    setGhiChu("");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Cột trái — chọn hàng */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ten}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg bg-dark/5 p-1 text-sm font-semibold">
            {(["le", "si"] as const).map((b) => (
              <button
                key={b}
                type="button"
                className={`rounded-md px-3 py-1.5 ${bangGia === b ? "bg-white shadow-sm" : "text-dark/50"}`}
                onClick={() => setBangGia(b)}
              >
                {b === "le" ? "Giá lẻ" : "Giá sỉ"}
              </button>
            ))}
          </div>

          <input
            className="input flex-1"
            placeholder="Tìm SKU, tên nước hoa, barcode…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ketQua.map((v) => {
            const con = ton(v.id);
            return (
              <button
                key={v.id}
                onClick={() => themVaoGio(v)}
                className="card p-3 text-left transition hover:border-dark/40 disabled:opacity-40"
                disabled={con <= 0}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{v.product?.ten}</div>
                    <div className="truncate text-xs text-dark/60">{v.ten_bien_the}</div>
                  </div>
                  <span
                    className={`badge shrink-0 ${con <= 0 ? "bg-warning/15 text-warning" : "bg-dark/5 text-dark/60"}`}
                  >
                    {con}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-dark/40">{v.sku}</span>
                  <span className="font-display text-sm font-extrabold">{formatVND(gia(v))}</span>
                </div>
              </button>
            );
          })}
          {ketQua.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-dark/40">
              Không tìm thấy sản phẩm
            </p>
          )}
        </div>
      </div>

      {/* Cột phải — giỏ hàng */}
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="card">
          <h2 className="mb-3 font-display font-extrabold">Đơn hàng</h2>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-dark/40">Chọn sản phẩm bên trái</p>
          ) : (
            <ul className="divide-y divide-dark/5">
              {cart.map((l) => (
                <li key={l.variant_id} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{l.ten_hien_thi}</div>
                      <div className="font-mono text-[11px] text-dark/40">{l.sku}</div>
                    </div>
                    <button
                      className="text-dark/30 hover:text-warning"
                      onClick={() => xoaDong(l.variant_id)}
                      aria-label="Xoá"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-dark/15">
                      <button
                        className="px-2 py-1 text-sm"
                        onClick={() =>
                          suaDong(l.variant_id, { so_luong: Math.max(1, l.so_luong - 1) })
                        }
                      >
                        −
                      </button>
                      <input
                        className="w-10 border-x border-dark/15 py-1 text-center text-sm outline-none"
                        value={l.so_luong}
                        onChange={(e) =>
                          suaDong(l.variant_id, {
                            so_luong: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1),
                          })
                        }
                      />
                      <button
                        className="px-2 py-1 text-sm"
                        onClick={() => suaDong(l.variant_id, { so_luong: l.so_luong + 1 })}
                      >
                        +
                      </button>
                    </div>
                    <input
                      className="input py-1 text-right text-sm"
                      value={l.don_gia}
                      onChange={(e) =>
                        suaDong(l.variant_id, {
                          don_gia: Number(e.target.value.replace(/\D/g, "")) || 0,
                        })
                      }
                    />
                    <span className="w-24 shrink-0 text-right text-sm font-semibold">
                      {formatVND(l.so_luong * l.don_gia - l.giam_gia)}
                    </span>
                  </div>
                  {l.so_luong > ton(l.variant_id) && (
                    <p className="mt-1 text-xs text-warning">
                      Chỉ còn {ton(l.variant_id)} tại cửa hàng này
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-3">
          <div>
            <label className="label">Khách hàng</label>
            <input
              className="input"
              placeholder="Tên khách (tuỳ chọn)"
              value={khachTen}
              onChange={(e) => setKhachTen(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.includes("\n")) {
                  e.preventDefault();
                  danThongTin(text);
                }
              }}
            />
          </div>
          <div>
            <label className="label">Số điện thoại</label>
            <input
              className="input"
              placeholder="09xx… (để tích luỹ lịch sử mua)"
              value={khachSdt}
              onChange={(e) => setKhachSdt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Giảm giá đơn</label>
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
          <div>
            <label className="label">Ghi chú</label>
            <input
              className="input"
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Tặng kèm mẫu thử, gói quà…"
            />
          </div>
        </div>

        <div className="card bg-dark text-paper">
          <div className="flex justify-between text-sm">
            <span className="text-paper/60">Tạm tính</span>
            <span>{formatVND(tamTinh)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-paper/60">Giảm giá</span>
            <span>−{formatVND(giamGia)}</span>
          </div>
          <div className="mt-2 flex items-end justify-between border-t border-paper/20 pt-2">
            <span className="text-sm text-paper/60">Khách trả</span>
            <span className="font-display text-2xl font-extrabold">{formatVND(tongTien)}</span>
          </div>

          {loi && (
            <p className="mt-3 rounded-lg bg-warning/20 px-3 py-2 text-xs text-warning">{loi}</p>
          )}
          {thieuHang.length > 0 && (
            <p className="mt-3 rounded-lg bg-warning/20 px-3 py-2 text-xs">
              Vượt tồn kho: {thieuHang.map((l) => l.sku).join(", ")}
            </p>
          )}

          <button
            className="btn-primary mt-3 w-full py-3 text-base"
            disabled={!cart.length || dangLuu || thieuHang.length > 0}
            onClick={thanhToanDon}
          >
            {dangLuu ? "Đang lưu…" : "Thanh toán"}
          </button>
        </div>

        {xong && (
          <div className="card border-lime bg-lime/20">
            <p className="text-sm font-semibold">
              Đã tạo đơn {xong.ma_don} — {formatVND(xong.tong)}
            </p>
            <p className="mt-1 text-xs text-dark/60">
              Tồn kho đã trừ tự động. Xem lại ở tab Đơn hàng.
            </p>
            <button className="btn-ghost mt-2 text-xs" onClick={() => setXong(null)}>
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
