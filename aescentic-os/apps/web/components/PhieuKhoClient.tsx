"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tienVND } from "./Bits";

type DiaDiem = { id: string; name: string; kind: string; managedBy: string };
type Sku = { id: string; code: string; ten: string; giaVon: number | null };
type Dong = { skuId: string; code: string; ten: string; soLuong: number; donGia: number };

/**
 * Lập phiếu nhập kho hoặc phiếu chuyển kho.
 *
 * Hai việc dùng chung một khung vì thao tác giống hệt nhau: chọn kho, chọn
 * hàng, nhập số lượng. Khác nhau đúng một chỗ — nhập kho cần đơn giá vốn.
 */
export default function PhieuKhoClient({
  kieu,
  diaDiem,
  skus,
  luu,
}: {
  kieu: "nhap" | "chuyen";
  diaDiem: DiaDiem[];
  skus: Sku[];
  luu: (p: {
    locationId: string;
    toLocationId?: string;
    supplierName?: string;
    note?: string;
    lines: { skuId: string; quantity: number; unitCost: number }[];
  }) => Promise<{ ok: true; code: string } | { ok: false; loi: string }>;
}) {
  const router = useRouter();
  const [dangChay, batDau] = useTransition();

  const [khoId, setKhoId] = useState(diaDiem[0]?.id ?? "");
  const [khoDenId, setKhoDenId] = useState(diaDiem[1]?.id ?? "");
  const [nhaCungCap, setNhaCungCap] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [q, setQ] = useState("");
  const [dong, setDong] = useState<Dong[]>([]);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);

  const laNhap = kieu === "nhap";

  const ketQua = useMemo(() => {
    const k = q.trim().toLowerCase();
    const ds = k
      ? skus.filter((s) => s.code.toLowerCase().includes(k) || s.ten.toLowerCase().includes(k))
      : skus;
    return ds.slice(0, 24);
  }, [q, skus]);

  const tongSL = dong.reduce((s, d) => s + d.soLuong, 0);
  const tongTien = dong.reduce((s, d) => s + d.soLuong * d.donGia, 0);

  function them(s: Sku) {
    setLoi(null);
    setDong((cur) => {
      const i = cur.findIndex((d) => d.skuId === s.id);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i]!, soLuong: next[i]!.soLuong + 1 };
        return next;
      }
      return [...cur, { skuId: s.id, code: s.code, ten: s.ten, soLuong: 1, donGia: s.giaVon ?? 0 }];
    });
  }

  function sua(skuId: string, truong: "soLuong" | "donGia", v: number) {
    setDong((cur) =>
      cur.map((d) => (d.skuId === skuId ? { ...d, [truong]: Math.max(0, v) } : d)),
    );
  }

  function luuPhieu() {
    if (!dong.length) return;
    if (laNhap && dong.some((d) => d.donGia <= 0)) {
      setLoi(
        "Phải nhập giá vốn cho mọi dòng. Giá vốn sai thì lợi nhuận của mọi đơn bán sau đó sai theo.",
      );
      return;
    }
    if (!laNhap && khoId === khoDenId) {
      setLoi("Kho gửi và kho nhận phải khác nhau.");
      return;
    }
    setLoi(null);
    batDau(async () => {
      const kq = await luu({
        locationId: khoId,
        toLocationId: laNhap ? undefined : khoDenId,
        supplierName: nhaCungCap || undefined,
        note: ghiChu || undefined,
        lines: dong.map((d) => ({ skuId: d.skuId, quantity: d.soLuong, unitCost: d.donGia })),
      });
      if (!kq.ok) {
        setLoi(kq.loi);
        return;
      }
      setXong(kq.code);
      setDong([]);
      setNhaCungCap("");
      setGhiChu("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{laNhap ? "Nhập vào kho" : "Chuyển từ kho"}</span>
            <select className="input" value={khoId} onChange={(e) => setKhoId(e.target.value)}>
              {diaDiem.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>

          {laNhap ? (
            <label className="block">
              <span className="label">Nhà cung cấp</span>
              <input
                className="input"
                value={nhaCungCap}
                onChange={(e) => setNhaCungCap(e.target.value)}
                placeholder="Xưởng Aescentic — Bình Dương"
              />
            </label>
          ) : (
            <label className="block">
              <span className="label">Đến kho</span>
              <select
                className="input"
                value={khoDenId}
                onChange={(e) => setKhoDenId(e.target.value)}
              >
                {diaDiem.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <input
          className="input"
          placeholder="Tìm SKU hoặc tên nước hoa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ketQua.map((s) => (
            <button
              key={s.id}
              data-sku={s.code}
              onClick={() => them(s)}
              className="border border-line bg-surface p-3 text-left transition hover:border-ink"
            >
              <div className="truncate text-sm font-semibold">{s.ten}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted">{s.code}</span>
                {laNhap && s.giaVon !== null && (
                  <span className="text-xs text-muted">vốn {tienVND(s.giaVon)}</span>
                )}
              </div>
            </button>
          ))}
          {ketQua.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted">
              Không tìm thấy sản phẩm
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="card">
          <h2 className="mb-3 font-bold">{laNhap ? "Hàng nhập" : "Hàng chuyển"}</h2>
          {dong.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Chọn sản phẩm bên trái</p>
          ) : (
            <ul className="divide-y divide-line">
              {dong.map((d) => (
                <li key={d.skuId} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{d.ten}</div>
                      <div className="font-mono text-[11px] text-muted">{d.code}</div>
                    </div>
                    <button
                      className="text-xs text-danger"
                      onClick={() => setDong((c) => c.filter((x) => x.skuId !== d.skuId))}
                    >
                      Bỏ
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      aria-label={`Số lượng ${d.code}`}
                      className="input w-20 py-1 text-sm"
                      value={d.soLuong}
                      onChange={(e) => sua(d.skuId, "soLuong", Number(e.target.value))}
                    />
                    {laNhap && (
                      <>
                        <span className="text-xs text-muted">×</span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          aria-label={`Giá vốn ${d.code}`}
                          className="input flex-1 py-1 text-sm"
                          value={d.donGia}
                          onChange={(e) => sua(d.skuId, "donGia", Number(e.target.value))}
                        />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-2">
          <label className="block">
            <span className="label">Ghi chú</span>
            <input className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
          </label>
        </div>

        <div className="bg-ink p-4 text-paper">
          <div className="flex justify-between text-sm">
            <span className="opacity-70">Số lượng</span>
            <span className="font-bold tabular-nums">{tongSL}</span>
          </div>
          {laNhap && (
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm opacity-70">Tổng tiền hàng</span>
              <span className="text-xl font-extrabold tabular-nums">{tienVND(tongTien)}</span>
            </div>
          )}

          {loi && <p className="mt-3 bg-danger/25 px-3 py-2 text-xs">{loi}</p>}

          <button
            className="mt-3 w-full bg-chip px-4 py-3 text-base font-bold text-ink disabled:opacity-50"
            disabled={!dong.length || dangChay}
            onClick={luuPhieu}
          >
            {dangChay ? "Đang lưu…" : laNhap ? "Nhập kho" : "Chuyển đi"}
          </button>
        </div>

        {xong && (
          <div data-xong={xong} className="border border-accent bg-chip/20 p-4">
            <p className="text-sm font-semibold">Đã tạo phiếu {xong}</p>
            <p className="mt-1 text-xs text-muted">
              {laNhap
                ? "Tồn kho đã cộng và giá vốn đã cập nhật."
                : "Hàng đã trừ ở kho gửi. Kho nhận bấm “Đã nhận” thì hàng mới vào."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
