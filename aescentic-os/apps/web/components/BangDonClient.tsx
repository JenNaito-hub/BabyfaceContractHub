"use client";

import { useState } from "react";
import Link from "next/link";
import { Kenh, ThanhToan, TrangThai, Trong, ngayGio, tienVND } from "./Bits";

export type DonTrongBang = {
  id: string;
  code: string;
  channel: string;
  storeName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  placedAt: string;
};

/**
 * Bảng đơn hàng, có tick chọn để in hàng loạt.
 *
 * Sáng đóng gói là in một lượt vài chục phiếu chứ không mở từng đơn — nên ô
 * tick nằm ngay trong dòng, và thanh công cụ chỉ hiện khi đã chọn.
 */
export default function BangDonClient({ ds }: { ds: DonTrongBang[] }) {
  const [chon, setChon] = useState<Set<string>>(new Set());

  if (!ds.length) return <Trong>Không có đơn nào khớp bộ lọc</Trong>;

  function doi(id: string) {
    const next = new Set(chon);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChon(next);
  }

  const tatCa = chon.size === ds.length && ds.length > 0;
  const danhSach = [...chon].join(",");

  return (
    <div>
      {chon.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-chip px-4 py-2">
          <span className="text-sm font-bold">Đã chọn {chon.size} đơn</span>
          <div className="flex flex-wrap gap-2">
            <a href={`/in?ids=${danhSach}&kieu=phieu`} target="_blank" className="btn-dark text-xs">
              In phiếu giao
            </a>
            <a
              href={`/in?ids=${danhSach}&kieu=hoadon`}
              target="_blank"
              className="btn-ghost bg-paper text-xs"
            >
              In hoá đơn
            </a>
            <button className="btn-ghost bg-paper text-xs" onClick={() => setChon(new Set())}>
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[900px] bg-surface">
          <thead>
            <tr>
              <th className="th w-10">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={tatCa}
                  onChange={() => setChon(tatCa ? new Set() : new Set(ds.map((o) => o.id)))}
                />
              </th>
              <th className="th">Mã đơn</th>
              <th className="th">Ngày</th>
              <th className="th">Kênh</th>
              <th className="th">Khách</th>
              <th className="th">Nơi bán</th>
              <th className="th text-right">Tổng tiền</th>
              <th className="th">Thanh toán</th>
              <th className="th">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((o) => (
              <tr
                key={o.id}
                className={chon.has(o.id) ? "bg-chip/30" : "hover:bg-ink/[0.02]"}
              >
                <td className="td">
                  <input
                    type="checkbox"
                    aria-label={`Chọn đơn ${o.code}`}
                    checked={chon.has(o.id)}
                    onChange={() => doi(o.id)}
                  />
                </td>
                <td className="td">
                  <Link
                    href={`/orders/${o.id}`}
                    className="font-mono text-xs font-semibold underline"
                  >
                    {o.code}
                  </Link>
                </td>
                <td className="td whitespace-nowrap text-muted">{ngayGio(o.placedAt)}</td>
                <td className="td">
                  <Kenh v={o.channel} />
                </td>
                <td className="td">
                  <div className="max-w-[170px] truncate">{o.customerName ?? "—"}</div>
                  <div className="font-mono text-[11px] text-muted">{o.customerPhone ?? ""}</div>
                </td>
                <td className="td text-muted">{o.storeName ?? "—"}</td>
                <td className="td text-right font-semibold tabular-nums">{tienVND(o.total)}</td>
                <td className="td">
                  <ThanhToan v={o.paymentStatus} />
                </td>
                <td className="td">
                  <TrangThai v={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
