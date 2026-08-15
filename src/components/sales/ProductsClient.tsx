"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { Empty } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/sales/calc";
import type { InventoryRow, Product, VariantCost, VariantFull } from "@/lib/sales/types";

const VARIANT_RONG = {
  id: "",
  product_id: "",
  sku: "",
  ten_bien_the: "",
  dung_tich_ml: "",
  barcode: "",
  gia_ban: "0",
  gia_si: "0",
  ton_toi_thieu: "0",
  khoi_luong_gram: "0",
  gia_von: "0",
  active: true,
};

export default function ProductsClient({
  products,
  variants,
  inventory,
  costs,
  isManager,
}: {
  products: Product[];
  variants: VariantFull[];
  inventory: InventoryRow[];
  costs: VariantCost[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chiHetHang, setChiHetHang] = useState(false);
  const [formSp, setFormSp] = useState<Partial<Product> | null>(null);
  const [formBt, setFormBt] = useState<typeof VARIANT_RONG | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, setDangLuu] = useState(false);

  const tonTong = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(r.variant_id, (m.get(r.variant_id) ?? 0) + r.so_luong);
    return m;
  }, [inventory]);

  const giaVon = useMemo(() => new Map(costs.map((c) => [c.variant_id, c.gia_von])), [costs]);

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase();
    return variants.filter((v) => {
      const ton = tonTong.get(v.id) ?? 0;
      if (chiHetHang && ton > v.ton_toi_thieu) return false;
      if (!key) return true;
      return (
        v.sku.toLowerCase().includes(key) ||
        (v.ten_bien_the ?? "").toLowerCase().includes(key) ||
        (v.product?.ten ?? "").toLowerCase().includes(key) ||
        (v.product?.dong_san_pham ?? "").toLowerCase().includes(key)
      );
    });
  }, [variants, q, chiHetHang, tonTong]);

  async function luuSanPham() {
    if (!formSp?.ten?.trim()) return;
    setDangLuu(true);
    setLoi(null);
    const supabase = createClient();
    const payload = {
      ten: formSp.ten.trim(),
      dong_san_pham: formSp.dong_san_pham || null,
      mo_ta: formSp.mo_ta || null,
      active: formSp.active ?? true,
    };
    const { error } = formSp.id
      ? await supabase.from("products").update(payload).eq("id", formSp.id)
      : await supabase.from("products").insert(payload);
    setDangLuu(false);
    if (error) return setLoi(error.message);
    setFormSp(null);
    router.refresh();
  }

  async function luuBienThe() {
    if (!formBt?.sku.trim() || !formBt.product_id) {
      setLoi("Cần chọn sản phẩm và nhập SKU");
      return;
    }
    setDangLuu(true);
    setLoi(null);

    const supabase = createClient();
    const payload = {
      product_id: formBt.product_id,
      sku: formBt.sku.trim(),
      ten_bien_the: formBt.ten_bien_the || null,
      dung_tich_ml: formBt.dung_tich_ml ? Number(formBt.dung_tich_ml) : null,
      barcode: formBt.barcode || null,
      gia_ban: Number(formBt.gia_ban) || 0,
      gia_si: Number(formBt.gia_si) || 0,
      ton_toi_thieu: Number(formBt.ton_toi_thieu) || 0,
      khoi_luong_gram: Number(formBt.khoi_luong_gram) || 0,
      active: formBt.active,
    };

    const { data, error } = formBt.id
      ? await supabase.from("variants").update(payload).eq("id", formBt.id).select("id").maybeSingle()
      : await supabase.from("variants").insert(payload).select("id").maybeSingle();

    if (error) {
      setDangLuu(false);
      return setLoi(error.message);
    }

    if (isManager && data?.id) {
      const { error: e2 } = await supabase
        .from("variant_costs")
        .upsert({ variant_id: data.id, gia_von: Number(formBt.gia_von) || 0, updated_at: new Date().toISOString() });
      if (e2) {
        setDangLuu(false);
        return setLoi(e2.message);
      }
    }

    setDangLuu(false);
    setFormBt(null);
    router.refresh();
  }

  function moSuaBienThe(v: VariantFull) {
    setFormBt({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      ten_bien_the: v.ten_bien_the ?? "",
      dung_tich_ml: v.dung_tich_ml ? String(v.dung_tich_ml) : "",
      barcode: v.barcode ?? "",
      gia_ban: String(v.gia_ban),
      gia_si: String(v.gia_si),
      ton_toi_thieu: String(v.ton_toi_thieu),
      khoi_luong_gram: String(v.khoi_luong_gram),
      gia_von: String(giaVon.get(v.id) ?? 0),
      active: v.active,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Sản phẩm</h1>
          <p className="text-sm text-dark/60">
            {products.length} sản phẩm · {variants.length} SKU
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setFormSp({ ten: "", active: true })}>
              + Sản phẩm
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                setFormBt({ ...VARIANT_RONG, product_id: products[0]?.id ?? "" })
              }
              disabled={products.length === 0}
            >
              + Biến thể (SKU)
            </button>
          </div>
        )}
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <input
          className="input flex-1"
          placeholder="Tìm SKU, tên nước hoa, dòng sản phẩm…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={chiHetHang}
            onChange={(e) => setChiHetHang(e.target.checked)}
          />
          Chỉ hiện SKU dưới ngưỡng tồn
        </label>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="card overflow-x-auto p-0">
        {ketQua.length === 0 ? (
          <Empty>Chưa có SKU nào khớp</Empty>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-dark/10">
                <th className="th">SKU</th>
                <th className="th">Sản phẩm</th>
                <th className="th">Biến thể</th>
                <th className="th text-right">Giá lẻ</th>
                <th className="th text-right">Giá sỉ</th>
                {isManager && <th className="th text-right">Giá vốn</th>}
                <th className="th text-right">Tồn</th>
                {isManager && <th className="th" />}
              </tr>
            </thead>
            <tbody>
              {ketQua.map((v) => {
                const ton = tonTong.get(v.id) ?? 0;
                const von = giaVon.get(v.id) ?? 0;
                const bien = v.gia_ban > 0 && von > 0 ? Math.round(((v.gia_ban - von) / v.gia_ban) * 100) : null;
                return (
                  <tr key={v.id} className={`border-b border-dark/5 ${v.active ? "" : "opacity-50"}`}>
                    <td className="td font-mono text-xs">{v.sku}</td>
                    <td className="td">
                      <div className="font-medium">{v.product?.ten}</div>
                      {v.product?.dong_san_pham && (
                        <div className="text-xs text-dark/50">{v.product.dong_san_pham}</div>
                      )}
                    </td>
                    <td className="td">
                      {v.ten_bien_the}
                      {v.dung_tich_ml ? ` · ${v.dung_tich_ml}ml` : ""}
                    </td>
                    <td className="td text-right">{formatVND(v.gia_ban)}</td>
                    <td className="td text-right text-dark/60">{formatVND(v.gia_si)}</td>
                    {isManager && (
                      <td className="td text-right">
                        {formatVND(von)}
                        {bien !== null && (
                          <div className="text-xs text-dark/50">biên {bien}%</div>
                        )}
                      </td>
                    )}
                    <td className="td text-right">
                      <span
                        className={`badge ${
                          ton <= 0
                            ? "bg-warning/15 text-warning"
                            : ton <= v.ton_toi_thieu
                              ? "bg-amber-100 text-amber-800"
                              : "bg-dark/5 text-dark/60"
                        }`}
                      >
                        {ton}
                      </span>
                    </td>
                    {isManager && (
                      <td className="td text-right">
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => moSuaBienThe(v)}>
                          Sửa
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formSp && (
        <Modal
          title={formSp.id ? "Sửa sản phẩm" : "Thêm sản phẩm"}
          onClose={() => setFormSp(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setFormSp(null)}>
                Huỷ
              </button>
              <button className="btn-primary" onClick={luuSanPham} disabled={dangLuu}>
                Lưu
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Tên sản phẩm *</label>
              <input
                className="input"
                value={formSp.ten ?? ""}
                onChange={(e) => setFormSp({ ...formSp, ten: e.target.value })}
                placeholder="VD: Eau de Parfum — Amber Nuit"
              />
            </div>
            <div>
              <label className="label">Dòng sản phẩm</label>
              <input
                className="input"
                value={formSp.dong_san_pham ?? ""}
                onChange={(e) => setFormSp({ ...formSp, dong_san_pham: e.target.value })}
                placeholder="VD: Signature / Travel size"
              />
            </div>
            <div>
              <label className="label">Mô tả</label>
              <textarea
                className="input h-20"
                value={formSp.mo_ta ?? ""}
                onChange={(e) => setFormSp({ ...formSp, mo_ta: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formSp.active ?? true}
                onChange={(e) => setFormSp({ ...formSp, active: e.target.checked })}
              />
              Đang kinh doanh
            </label>
          </div>
        </Modal>
      )}

      {formBt && (
        <Modal
          title={formBt.id ? "Sửa biến thể" : "Thêm biến thể"}
          onClose={() => setFormBt(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setFormBt(null)}>
                Huỷ
              </button>
              <button className="btn-primary" onClick={luuBienThe} disabled={dangLuu}>
                Lưu
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Sản phẩm *</label>
              <select
                className="input"
                value={formBt.product_id}
                onChange={(e) => setFormBt({ ...formBt, product_id: e.target.value })}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ten}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">SKU * (khớp SKU trên sàn)</label>
              <input
                className="input font-mono"
                value={formBt.sku}
                onChange={(e) => setFormBt({ ...formBt, sku: e.target.value })}
                placeholder="AMB-50"
              />
            </div>
            <div>
              <label className="label">Tên biến thể</label>
              <input
                className="input"
                value={formBt.ten_bien_the}
                onChange={(e) => setFormBt({ ...formBt, ten_bien_the: e.target.value })}
                placeholder="Amber Nuit 50ml"
              />
            </div>
            <div>
              <label className="label">Dung tích (ml)</label>
              <input
                className="input"
                value={formBt.dung_tich_ml}
                onChange={(e) =>
                  setFormBt({ ...formBt, dung_tich_ml: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>
            <div>
              <label className="label">Barcode</label>
              <input
                className="input font-mono"
                value={formBt.barcode}
                onChange={(e) => setFormBt({ ...formBt, barcode: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Giá lẻ</label>
              <input
                className="input text-right"
                value={formBt.gia_ban}
                onChange={(e) =>
                  setFormBt({ ...formBt, gia_ban: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>
            <div>
              <label className="label">Giá sỉ</label>
              <input
                className="input text-right"
                value={formBt.gia_si}
                onChange={(e) => setFormBt({ ...formBt, gia_si: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            {isManager && (
              <div>
                <label className="label">Giá vốn (chỉ quản lý thấy)</label>
                <input
                  className="input text-right"
                  value={formBt.gia_von}
                  onChange={(e) =>
                    setFormBt({ ...formBt, gia_von: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
            )}
            <div>
              <label className="label">Ngưỡng cảnh báo tồn</label>
              <input
                className="input text-right"
                value={formBt.ton_toi_thieu}
                onChange={(e) =>
                  setFormBt({ ...formBt, ton_toi_thieu: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>
            <div>
              <label className="label">Khối lượng cả hộp (gram)</label>
              <input
                className="input text-right"
                value={formBt.khoi_luong_gram}
                onChange={(e) =>
                  setFormBt({ ...formBt, khoi_luong_gram: e.target.value.replace(/\D/g, "") })
                }
                placeholder="300"
              />
              <p className="mt-1 text-xs text-dark/50">Dùng để hãng ship tính phí. Bỏ trống = 300g.</p>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={formBt.active}
                onChange={(e) => setFormBt({ ...formBt, active: e.target.checked })}
              />
              Đang bán
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
