"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tienVND } from "./Bits";

type DiaDiem = { id: string; name: string; storeId: string; storeName: string };
type Sku = {
  id: string;
  code: string;
  name: string | null;
  productName: string;
  barcode: string | null;
  retailPrice: number;
  wholesalePrice: number;
};
type Dong = { skuId: string; code: string; ten: string; soLuong: number; donGia: number };

export default function PosClient({
  diaDiem,
  diaDiemChon,
  skus,
  ton,
  banHang,
}: {
  diaDiem: DiaDiem[];
  diaDiemChon: string;
  skus: Sku[];
  ton: Record<string, number>;
  banHang: (p: {
    locationId: string;
    storeId: string;
    customerName: string;
    customerPhone: string;
    discount: number;
    paymentStatus: string;
    note: string;
    lines: { skuId: string; quantity: number; unitPrice: number }[];
  }) => Promise<{ ok: true; id: string; code: string } | { ok: false; loi: string }>;
}) {
  const router = useRouter();
  const [dangChay, batDau] = useTransition();

  const [bangGia, setBangGia] = useState<"le" | "si">("le");
  const [q, setQ] = useState("");
  const [gio, setGio] = useState<Dong[]>([]);
  const [tenKhach, setTenKhach] = useState("");
  const [sdt, setSdt] = useState("");
  const [giamGia, setGiamGia] = useState(0);
  const [thanhToan, setThanhToan] = useState("paid");
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<{ id: string; code: string } | null>(null);

  const kho = diaDiem.find((l) => l.id === diaDiemChon) ?? diaDiem[0]!;
  const gia = (s: Sku) => (bangGia === "si" && s.wholesalePrice > 0 ? s.wholesalePrice : s.retailPrice);
  const con = (skuId: string) => ton[skuId] ?? 0;

  const ketQua = useMemo(() => {
    const k = q.trim().toLowerCase();
    const ds = k
      ? skus.filter(
          (s) =>
            s.code.toLowerCase().includes(k) ||
            s.productName.toLowerCase().includes(k) ||
            (s.name ?? "").toLowerCase().includes(k) ||
            (s.barcode ?? "").includes(k),
        )
      : skus;
    return ds.slice(0, 36);
  }, [q, skus]);

  const tamTinh = gio.reduce((s, d) => s + d.soLuong * d.donGia, 0);
  const tongTien = Math.max(0, tamTinh - giamGia);
  const vuotTon = gio.filter((d) => d.soLuong > con(d.skuId));

  function them(s: Sku) {
    setLoi(null);
    setGio((cur) => {
      const i = cur.findIndex((d) => d.skuId === s.id);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i]!, soLuong: next[i]!.soLuong + 1 };
        return next;
      }
      return [
        ...cur,
        { skuId: s.id, code: s.code, ten: `${s.productName} ${s.name ?? ""}`.trim(), soLuong: 1, donGia: gia(s) },
      ];
    });
  }

  function chotDon() {
    if (!gio.length) return;
    setLoi(null);
    batDau(async () => {
      const kq = await banHang({
        locationId: kho.id,
        storeId: kho.storeId,
        customerName: tenKhach,
        customerPhone: sdt,
        discount: giamGia,
        paymentStatus: thanhToan,
        note: ghiChu,
        lines: gio.map((d) => ({ skuId: d.skuId, quantity: d.soLuong, unitPrice: d.donGia })),
      });
      if (!kq.ok) {
        setLoi(kq.loi);
        return;
      }
      setXong({ id: kq.id, code: kq.code });
      setGio([]);
      setTenKhach("");
      setSdt("");
      setGiamGia(0);
      setGhiChu("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={kho.id}
            onChange={(e) => router.push(`/pos?kho=${e.target.value}`)}
          >
            {diaDiem.map((l) => (
              <option key={l.id} value={l.id}>{l.storeName} — {l.name}</option>
            ))}
          </select>

          <div className="flex border border-line text-sm font-semibold">
            {(["le", "si"] as const).map((b) => (
              <button
                key={b}
                type="button"
                className={`px-3 py-1.5 ${bangGia === b ? "bg-ink text-paper" : "text-muted"}`}
                onClick={() => setBangGia(b)}
              >
                {b === "le" ? "Giá lẻ" : "Giá sỉ"}
              </button>
            ))}
          </div>

          <input
            className="input flex-1"
            placeholder="Tìm SKU, tên nước hoa, quét mã vạch…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !q.trim()) return;
              e.preventDefault();
              const k = q.trim().toLowerCase();
              const khop =
                skus.find((s) => s.barcode?.toLowerCase() === k) ??
                skus.find((s) => s.code.toLowerCase() === k) ??
                ketQua[0];
              if (khop && con(khop.id) > 0) {
                them(khop);
                setQ("");
              } else if (khop) setLoi(`${khop.code} đã hết hàng tại địa điểm này`);
            }}
            autoFocus
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ketQua.map((s) => {
            const c = con(s.id);
            return (
              <button
                key={s.id}
                data-sku={s.code}
                onClick={() => them(s)}
                disabled={c <= 0}
                className="border border-line bg-surface p-3 text-left transition hover:border-ink disabled:opacity-40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.productName}</div>
                    <div className="truncate text-xs text-muted">{s.name}</div>
                  </div>
                  <span className={`pill shrink-0 ${c <= 0 ? "bg-danger/15 text-danger" : "bg-line text-muted"}`}>
                    {c}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted">{s.code}</span>
                  <span className="text-sm font-extrabold tabular-nums">{tienVND(gia(s))}</span>
                </div>
              </button>
            );
          })}
          {ketQua.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted">Không tìm thấy sản phẩm</p>
          )}
        </div>
      </div>

      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="card">
          <h2 className="mb-3 font-bold">Đơn hàng</h2>
          {gio.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Chọn sản phẩm bên trái</p>
          ) : (
            <ul className="divide-y divide-line">
              {gio.map((d) => (
                <li key={d.skuId} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{d.ten}</div>
                      <div className="font-mono text-[11px] text-muted">{d.code}</div>
                    </div>
                    <button
                      className="text-muted hover:text-danger"
                      onClick={() => setGio((c) => c.filter((x) => x.skuId !== d.skuId))}
                      aria-label="Xoá"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center border border-line">
                      <button
                        className="px-2 py-1 text-sm"
                        onClick={() =>
                          setGio((c) =>
                            c.map((x) => (x.skuId === d.skuId ? { ...x, soLuong: Math.max(1, x.soLuong - 1) } : x)),
                          )
                        }
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-sm tabular-nums">{d.soLuong}</span>
                      <button
                        className="px-2 py-1 text-sm"
                        onClick={() =>
                          setGio((c) => c.map((x) => (x.skuId === d.skuId ? { ...x, soLuong: x.soLuong + 1 } : x)))
                        }
                      >
                        +
                      </button>
                    </div>
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {tienVND(d.soLuong * d.donGia)}
                    </span>
                  </div>
                  {d.soLuong > con(d.skuId) && (
                    <p className="mt-1 text-xs text-danger">Chỉ còn {con(d.skuId)} tại địa điểm này</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-3">
          <div>
            <label className="label">Tên khách</label>
            <input className="input" value={tenKhach} onChange={(e) => setTenKhach(e.target.value)} />
          </div>
          <div>
            <label className="label">Số điện thoại</label>
            <input
              className="input"
              placeholder="09xx… để tích luỹ lịch sử mua"
              value={sdt}
              onChange={(e) => setSdt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <select className="input" value={thanhToan} onChange={(e) => setThanhToan(e.target.value)}>
                <option value="paid">Đã thanh toán</option>
                <option value="cod">COD</option>
                <option value="unpaid">Chưa thu</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
          </div>
        </div>

        <div className="bg-ink px-5 py-4 text-paper">
          <div className="flex justify-between text-sm">
            <span className="text-paper/60">Tạm tính</span>
            <span className="tabular-nums">{tienVND(tamTinh)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-paper/60">Giảm giá</span>
            <span className="tabular-nums">−{tienVND(giamGia)}</span>
          </div>
          <div className="mt-2 flex items-end justify-between border-t border-paper/20 pt-2">
            <span className="text-sm text-paper/60">Khách trả</span>
            <span className="text-2xl font-extrabold tabular-nums">{tienVND(tongTien)}</span>
          </div>

          {loi && <p className="mt-3 bg-danger/20 px-3 py-2 text-xs">{loi}</p>}
          {vuotTon.length > 0 && (
            <p className="mt-3 bg-danger/20 px-3 py-2 text-xs">
              Vượt tồn kho: {vuotTon.map((d) => d.code).join(", ")}
            </p>
          )}

          <button
            className="mt-3 w-full bg-chip px-4 py-3 text-base font-bold text-ink disabled:opacity-50"
            disabled={!gio.length || dangChay || vuotTon.length > 0}
            onClick={chotDon}
          >
            {dangChay ? "Đang lưu…" : "Thanh toán"}
          </button>
        </div>

        {xong && (
          <div data-xong={xong.code} className="border border-accent bg-chip/20 p-4">
            <p className="text-sm font-semibold">Đã tạo đơn {xong.code}</p>
            <p className="mt-1 text-xs text-muted">Tồn kho đã trừ tự động.</p>
            <div className="mt-2 flex gap-2">
              <a href={`/orders/${xong.id}`} className="btn-ghost text-xs">Xem đơn</a>
              <button className="btn-ghost text-xs" onClick={() => setXong(null)}>Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
