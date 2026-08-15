"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  docFile,
  dungDonHang,
  IMPORT_FIELDS,
  tachDiaChi,
  tuDongMap,
  type DraftOrder,
  type ImportField,
  type Kenh,
  type Mapping,
  type ParsedSheet,
} from "@aescentic/marketplace";
import { NHAN_KENH, NHAN_TRANG_THAI, type TrangThaiDon } from "@aescentic/sales/labels";
import { tienVND } from "./Bits";

type DiaDiem = { id: string; name: string; storeId: string; storeName: string };
type SkuNhe = { id: string; code: string; ten: string };

const KENH_NHAP: Kenh[] = ["shopee", "tiktok", "facebook", "website"];

export default function NhapDonClient({
  diaDiem,
  skus,
  nhapDon,
}: {
  diaDiem: DiaDiem[];
  skus: SkuNhe[];
  nhapDon: (p: {
    kenh: string;
    storeId: string;
    locationId: string;
    dons: {
      maDonSan: string;
      ngayDat: string | null;
      khachTen: string;
      khachSdt: string;
      diaChi: string;
      tinh: string;
      quan: string;
      phiShip: number;
      giamGia: number;
      maVanDon: string;
      donViVanChuyen: string;
      trangThai: TrangThaiDon;
      lines: { skuId: string; quantity: number; unitPrice: number }[];
    }[];
  }) => Promise<
    { ok: true; daNhap: number; boQua: number; loi: { maDonSan: string; lyDo: string }[] }
    | { ok: false; loi: string }
  >;
}) {
  const router = useRouter();
  const [dangChay, batDau] = useTransition();

  const [kenh, setKenh] = useState<Kenh>("shopee");
  const [khoId, setKhoId] = useState(diaDiem[0]?.id ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [tenFile, setTenFile] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [loi, setLoi] = useState<string | null>(null);
  const [ketQua, setKetQua] = useState<{
    daNhap: number;
    boQua: number;
    loi: { maDonSan: string; lyDo: string }[];
  } | null>(null);

  const skuIndex = useMemo(
    () => new Map(skus.map((s) => [s.code.toLowerCase(), { id: s.id, ten: s.ten }])),
    [skus],
  );

  const draft: DraftOrder[] = useMemo(() => {
    if (!sheet) return [];
    return dungDonHang(sheet.rows, mapping, skuIndex);
  }, [sheet, mapping, skuIndex]);

  const nhapDuoc = draft.filter((d) => d.loi.length === 0);
  const hong = draft.filter((d) => d.loi.length > 0);
  const kho = diaDiem.find((l) => l.id === khoId);

  const thieuBatBuoc = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);

  async function chonFile(f: File | null) {
    setLoi(null);
    setKetQua(null);
    if (!f) return;
    try {
      const s = await docFile(f);
      if (!s.rows.length) {
        setLoi("File không có dòng dữ liệu nào đọc được.");
        return;
      }
      setSheet(s);
      setTenFile(f.name);
      setMapping(tuDongMap(s.headers, kenh));
    } catch (e) {
      setLoi(`Không đọc được file: ${(e as Error).message}`);
    }
  }

  function nhap() {
    if (!kho || !nhapDuoc.length) return;
    setLoi(null);
    batDau(async () => {
      const kq = await nhapDon({
        kenh,
        storeId: kho.storeId,
        locationId: kho.id,
        dons: nhapDuoc.map((d) => {
          // Địa chỉ sàn xuất ra là một chuỗi dài; tách để lọc theo tỉnh sau này.
          const dc = tachDiaChi(d.dia_chi);
          return {
            maDonSan: d.ma_don_san,
            ngayDat: d.ngay_dat,
            khachTen: d.khach_ten,
            khachSdt: d.khach_sdt,
            diaChi: d.dia_chi,
            tinh: dc.tinh,
            quan: dc.quan,
            phiShip: d.phi_ship,
            giamGia: d.giam_gia,
            maVanDon: d.ma_van_don,
            donViVanChuyen: d.don_vi_van_chuyen,
            trangThai: d.trang_thai as TrangThaiDon,
            lines: d.items
              .filter((it) => it.variant_id)
              .map((it) => ({
                skuId: it.variant_id!,
                quantity: it.so_luong,
                unitPrice: it.don_gia,
              })),
          };
        }),
      });

      if (!kq.ok) {
        setLoi(kq.loi);
        return;
      }
      setKetQua({ daNhap: kq.daNhap, boQua: kq.boQua, loi: kq.loi });
      setSheet(null);
      setTenFile("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="label">Kênh bán</span>
          <select
            className="input"
            value={kenh}
            onChange={(e) => {
              const k = e.target.value as Kenh;
              setKenh(k);
              // Đổi sàn thì đoán lại cột: mỗi sàn đặt tên tiêu đề một kiểu.
              if (sheet) setMapping(tuDongMap(sheet.headers, k));
            }}
          >
            {KENH_NHAP.map((k) => (
              <option key={k} value={k}>{NHAN_KENH[k] ?? k}</option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Trừ kho tại</span>
          <select className="input" value={khoId} onChange={(e) => setKhoId(e.target.value)}>
            {diaDiem.map((l) => (
              <option key={l.id} value={l.id}>{l.storeName} — {l.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-2 border-dashed border-line bg-surface p-6 text-center">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={(e) => chonFile(e.target.files?.[0] ?? null)}
          className="mx-auto block text-sm"
        />
        <p className="mt-2 text-xs text-muted">
          Tải file đơn hàng xuất từ {NHAN_KENH[kenh] ?? kenh}. Nhận .xlsx, .xls và .csv.
        </p>
        {tenFile && (
          <p className="mt-2 font-mono text-[11px]">
            {tenFile} · {sheet?.rows.length ?? 0} dòng
          </p>
        )}
      </div>

      {loi && <p className="border-l-[3px] border-danger bg-surface px-4 py-3 text-sm">{loi}</p>}

      {ketQua && (
        <div className="border-l-[3px] border-accent bg-surface px-4 py-3 text-sm">
          <strong>Nhập xong.</strong> {ketQua.daNhap} đơn mới
          {ketQua.boQua > 0 && `, ${ketQua.boQua} đơn đã có từ trước nên bỏ qua`}
          {ketQua.loi.length > 0 && `, ${ketQua.loi.length} đơn lỗi`}.
          {ketQua.loi.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted">
              {ketQua.loi.slice(0, 10).map((l) => (
                <li key={l.maDonSan}>{l.maDonSan}: {l.lyDo}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sheet && (
        <>
          <section>
            <h2 className="mb-1 font-bold">Ghép cột</h2>
            <p className="mb-3 text-xs text-muted">
              Đã đoán theo tên cột của {NHAN_KENH[kenh] ?? kenh}. Sàn đổi tên cột thì chọn lại ở đây.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label">
                    {f.label}
                    {f.required && <span className="text-danger"> *</span>}
                  </span>
                  <select
                    className="input"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.key as ImportField]: e.target.value || undefined }))
                    }
                  >
                    <option value="">— bỏ qua —</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-bold">Xem trước</h2>
                <p className="text-sm text-muted">
                  {draft.length} đơn · <strong>{nhapDuoc.length} nhập được</strong>
                  {hong.length > 0 && ` · ${hong.length} cần sửa`}
                </p>
              </div>
              <button
                className="btn-dark"
                disabled={dangChay || !nhapDuoc.length || thieuBatBuoc.length > 0}
                onClick={nhap}
              >
                {dangChay ? "Đang nhập…" : `Nhập ${nhapDuoc.length} đơn`}
              </button>
            </div>

            {thieuBatBuoc.length > 0 && (
              <p className="mb-3 border-l-[3px] border-danger bg-surface px-4 py-3 text-sm">
                Chưa ghép cột bắt buộc: {thieuBatBuoc.map((f) => f.label).join(", ")}.
              </p>
            )}

            {hong.length > 0 && (
              <div className="mb-4 border border-danger/40 bg-surface">
                <div className="border-b border-line px-4 py-2 text-sm font-bold">
                  {hong.length} đơn chưa nhập được
                </div>
                <ul className="divide-y divide-line text-sm">
                  {hong.slice(0, 20).map((d) => (
                    <li key={d.ma_don_san} className="px-4 py-2">
                      <span className="font-mono text-xs">{d.ma_don_san || "(thiếu mã)"}</span>
                      <span className="ml-2 text-muted">{d.loi.join("; ")}</span>
                    </li>
                  ))}
                </ul>
                <p className="px-4 py-2 text-xs text-muted">
                  SKU lạ sẽ không tự tạo sản phẩm mới. Thêm SKU vào danh mục rồi tải lại file.
                </p>
              </div>
            )}

            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[800px] bg-surface">
                <thead>
                  <tr>
                    <th className="th">Mã đơn sàn</th>
                    <th className="th">Ngày</th>
                    <th className="th">Khách</th>
                    <th className="th">Sản phẩm</th>
                    <th className="th text-right">Tổng tiền</th>
                    <th className="th">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.slice(0, 60).map((d) => (
                    <tr key={d.ma_don_san} className={d.loi.length ? "bg-danger/[0.04]" : ""}>
                      <td className="td font-mono text-xs">{d.ma_don_san || "—"}</td>
                      <td className="td whitespace-nowrap text-muted">
                        {d.ngay_dat ? d.ngay_dat.slice(0, 10) : "—"}
                      </td>
                      <td className="td">
                        <div className="max-w-[160px] truncate">{d.khach_ten || "—"}</div>
                        <div className="font-mono text-[11px] text-muted">{d.khach_sdt}</div>
                      </td>
                      <td className="td text-xs">
                        {d.items.map((it) => (
                          <div key={it.sku} className={it.variant_id ? "" : "text-danger"}>
                            {it.sku} × {it.so_luong}
                          </div>
                        ))}
                      </td>
                      <td className="td text-right font-semibold tabular-nums">
                        {tienVND(d.tong_tien)}
                      </td>
                      <td className="td text-muted">
                        {NHAN_TRANG_THAI[d.trang_thai as TrangThaiDon] ?? d.trang_thai}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {draft.length > 60 && (
              <p className="mt-2 text-xs text-muted">
                Đang xem 60 đơn đầu. Bấm nhập sẽ xử lý cả {nhapDuoc.length} đơn hợp lệ.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
