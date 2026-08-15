"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/sales/calc";
import { KENH_LABEL, TRANG_THAI_LABEL } from "@/lib/sales/constants";
import {
  docFile,
  dungDonHang,
  IMPORT_FIELDS,
  tuDongMap,
  type DraftOrder,
  type ImportField,
  type Mapping,
  type ParsedSheet,
} from "@/lib/sales/importers";
import type { Kenh, Store, VariantFull } from "@/lib/sales/types";

type KetQuaImport = { ok: number; loi: { ma: string; msg: string }[] };

export default function ImportClient({
  stores,
  variants,
}: {
  stores: Store[];
  variants: VariantFull[];
}) {
  const khoOnline = stores.find((s) => s.loai === "warehouse");

  const [kenh, setKenh] = useState<Kenh>("shopee");
  const [storeId, setStoreId] = useState(khoOnline?.id ?? stores[0]?.id ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [tenFile, setTenFile] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [boQuaKho, setBoQuaKho] = useState(true);
  const [daCo, setDaCo] = useState<Set<string>>(new Set());
  const [dangChay, setDangChay] = useState(false);
  const [ketQua, setKetQua] = useState<KetQuaImport | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  const skuIndex = useMemo(() => {
    const m = new Map<string, { id: string; ten: string }>();
    for (const v of variants) {
      m.set(v.sku.toLowerCase(), {
        id: v.id,
        ten: `${v.product?.ten ?? ""} ${v.ten_bien_the ?? ""}`.trim(),
      });
      if (v.barcode) m.set(v.barcode.toLowerCase(), { id: v.id, ten: v.sku });
    }
    return m;
  }, [variants]);

  const drafts: DraftOrder[] = useMemo(() => {
    if (!sheet || !mapping.ma_don_san || !mapping.sku) return [];
    return dungDonHang(sheet.rows, mapping, skuIndex);
  }, [sheet, mapping, skuIndex]);

  const hopLe = drafts.filter((d) => d.loi.length === 0 && !daCo.has(d.ma_don_san));
  const trung = drafts.filter((d) => daCo.has(d.ma_don_san));
  const hong = drafts.filter((d) => d.loi.length > 0 && !daCo.has(d.ma_don_san));

  async function chonFile(file: File) {
    setLoi(null);
    setKetQua(null);
    setTenFile(file.name);
    try {
      const parsed = await docFile(file);
      setSheet(parsed);
      const auto = tuDongMap(parsed.headers, kenh);
      setMapping(auto);
      await kiemTraTrung(parsed, auto);
    } catch (e) {
      setLoi(`Không đọc được file: ${(e as Error).message}`);
    }
  }

  /** Đối chiếu mã đơn sàn đã có trong DB để không import trùng. */
  async function kiemTraTrung(parsed: ParsedSheet, map: Mapping) {
    if (!map.ma_don_san) return;
    const codes = [
      ...new Set(parsed.rows.map((r) => String(r[map.ma_don_san!] ?? "").trim()).filter(Boolean)),
    ];
    if (!codes.length) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("ma_don_san")
      .eq("kenh", kenh)
      .in("ma_don_san", codes.slice(0, 1000));

    setDaCo(new Set((data ?? []).map((r: { ma_don_san: string }) => r.ma_don_san)));
  }

  async function chayImport() {
    if (!hopLe.length) return;
    setDangChay(true);
    setLoi(null);

    const supabase = createClient();
    const res: KetQuaImport = { ok: 0, loi: [] };

    for (const d of hopLe) {
      const { error } = await supabase.rpc("tao_don_hang", {
        p_order: {
          kenh,
          store_id: storeId,
          khach_ten: d.khach_ten,
          khach_sdt: d.khach_sdt,
          dia_chi: d.dia_chi,
          thanh_toan: "da_thanh_toan",
          giam_gia: d.giam_gia,
          phi_ship: d.phi_ship,
          don_vi_van_chuyen: d.don_vi_van_chuyen,
          ma_van_don: d.ma_van_don,
          ma_don_san: d.ma_don_san,
          ngay_dat: d.ngay_dat,
          bo_qua_kho: boQuaKho,
          ghi_chu: `Import từ ${KENH_LABEL[kenh]}`,
        },
        p_items: d.items.map((it) => ({
          variant_id: it.variant_id,
          sku: it.sku,
          ten_hien_thi: it.ten_hien_thi,
          so_luong: it.so_luong,
          don_gia: it.don_gia,
        })),
        p_trang_thai: d.trang_thai,
      });

      if (error) res.loi.push({ ma: d.ma_don_san, msg: error.message });
      else res.ok += 1;
    }

    setDangChay(false);
    setKetQua(res);
    setDaCo((cur) => new Set([...cur, ...hopLe.map((d) => d.ma_don_san)]));
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales/orders" className="text-xs font-semibold text-dark/50 underline">
          ← Đơn hàng
        </Link>
        <h1 className="mt-1 font-display text-2xl font-extrabold">Nhập đơn từ file sàn</h1>
        <p className="text-sm text-dark/60">
          Tải file Excel/CSV xuất từ Shopee hoặc TikTok Shop. Hệ thống tự đoán cột, bạn chỉ cần
          kiểm tra lại rồi bấm import. Mã đơn đã có sẽ tự bị bỏ qua.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Kênh</label>
            <select
              className="input"
              value={kenh}
              onChange={(e) => {
                const k = e.target.value as Kenh;
                setKenh(k);
                if (sheet) setMapping(tuDongMap(sheet.headers, k));
              }}
            >
              {(["shopee", "tiktok", "website", "facebook"] as Kenh[]).map((k) => (
                <option key={k} value={k}>
                  {KENH_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kho ghi nhận</label>
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ten}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">File</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="input py-1.5"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) chonFile(f);
              }}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={boQuaKho}
            onChange={(e) => setBoQuaKho(e.target.checked)}
          />
          <span>
            Không trừ tồn kho cho các đơn này
            <span className="block text-xs text-dark/50">
              Bật khi import đơn cũ / đơn sàn đã tự trừ kho bên ngoài. Tắt nếu muốn hệ thống trừ
              kho thật (sẽ báo lỗi nếu không đủ hàng).
            </span>
          </span>
        </label>

        {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}
      </div>

      {sheet && (
        <div className="card">
          <h2 className="mb-1 font-display font-extrabold">Ghép cột</h2>
          <p className="mb-3 text-xs text-dark/50">
            {tenFile} · {sheet.rows.length} dòng · {sheet.headers.length} cột
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">
                  {f.label}
                  {f.required && <span className="text-warning"> *</span>}
                </label>
                <select
                  className="input"
                  value={mapping[f.key as ImportField] ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f.key]: e.target.value || undefined })
                  }
                >
                  <option value="">— không dùng —</option>
                  {sheet.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-dark/50">Sẵn sàng import</div>
              <div className="font-display text-2xl font-extrabold">{hopLe.length}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-dark/50">Đã có trong hệ thống</div>
              <div className="font-display text-2xl font-extrabold text-dark/40">{trung.length}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-dark/50">Cần xử lý</div>
              <div className="font-display text-2xl font-extrabold text-warning">{hong.length}</div>
            </div>
          </div>

          {hong.length > 0 && (
            <div className="card border-warning/40">
              <h2 className="mb-2 font-display font-extrabold text-warning">
                Đơn chưa import được
              </h2>
              <p className="mb-2 text-xs text-dark/60">
                Thường do SKU trên sàn chưa khớp SKU trong danh mục. Vào tab Sản phẩm tạo/sửa SKU
                cho khớp rồi tải lại file.
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
                {hong.slice(0, 50).map((d) => (
                  <li key={d.ma_don_san} className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs">{d.ma_don_san || "(trống)"}</span>
                    <span className="text-warning">{d.loi.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">Mã đơn sàn</th>
                  <th className="th">Khách</th>
                  <th className="th">Sản phẩm</th>
                  <th className="th text-right">Tổng</th>
                  <th className="th">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {drafts.slice(0, 100).map((d) => {
                  const bied = daCo.has(d.ma_don_san);
                  return (
                    <tr
                      key={d.ma_don_san}
                      className={`border-b border-dark/5 ${bied || d.loi.length ? "opacity-50" : ""}`}
                    >
                      <td className="td font-mono text-xs">{d.ma_don_san || "—"}</td>
                      <td className="td">
                        <div className="max-w-[160px] truncate">{d.khach_ten || "—"}</div>
                        <div className="text-xs text-dark/50">{d.khach_sdt}</div>
                      </td>
                      <td className="td text-xs">
                        {d.items.map((it) => `${it.sku} ×${it.so_luong}`).join(", ")}
                      </td>
                      <td className="td text-right">{formatVND(d.tong_tien)}</td>
                      <td className="td text-xs">
                        {bied ? (
                          <span className="text-dark/40">Đã có</span>
                        ) : d.loi.length ? (
                          <span className="text-warning">Lỗi</span>
                        ) : (
                          TRANG_THAI_LABEL[d.trang_thai]
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3">
            {ketQua && (
              <p className="text-sm">
                Đã import <strong>{ketQua.ok}</strong> đơn
                {ketQua.loi.length > 0 && (
                  <span className="text-warning"> · {ketQua.loi.length} đơn lỗi</span>
                )}
              </p>
            )}
            <button
              className="btn-primary"
              onClick={chayImport}
              disabled={dangChay || hopLe.length === 0}
            >
              {dangChay ? "Đang import…" : `Import ${hopLe.length} đơn`}
            </button>
          </div>

          {ketQua && ketQua.loi.length > 0 && (
            <div className="card border-warning/40">
              <h2 className="mb-2 font-display font-extrabold text-warning">Lỗi khi import</h2>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
                {ketQua.loi.map((l) => (
                  <li key={l.ma}>
                    <span className="font-mono text-xs">{l.ma}</span> — {l.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
