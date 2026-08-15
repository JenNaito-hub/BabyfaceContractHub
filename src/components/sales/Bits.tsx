import {
  KENH_COLOR,
  KENH_LABEL,
  THANH_TOAN_LABEL,
  TRANG_THAI_LABEL,
} from "@/lib/sales/constants";
import type { Kenh, TrangThaiDon, TrangThaiThanhToan } from "@/lib/sales/types";

export function KenhBadge({ kenh }: { kenh: Kenh }) {
  return (
    <span
      className="badge text-white"
      style={{ backgroundColor: KENH_COLOR[kenh] ?? "#5B5B5B", color: kenh === "store" ? "#1A1A1A" : "#fff" }}
    >
      {KENH_LABEL[kenh] ?? kenh}
    </span>
  );
}

const TRANG_THAI_CLASS: Record<TrangThaiDon, string> = {
  moi: "bg-dark/10 text-dark/70",
  da_xac_nhan: "bg-blue-100 text-blue-800",
  dang_giao: "bg-amber-100 text-amber-800",
  hoan_thanh: "bg-lime text-dark",
  huy: "bg-warning/15 text-warning",
  hoan: "bg-warning/15 text-warning",
};

export function TrangThaiBadge({ trangThai }: { trangThai: TrangThaiDon }) {
  return (
    <span className={`badge ${TRANG_THAI_CLASS[trangThai] ?? "bg-dark/10"}`}>
      {TRANG_THAI_LABEL[trangThai] ?? trangThai}
    </span>
  );
}

export function ThanhToanBadge({ tt }: { tt: TrangThaiThanhToan }) {
  const cls =
    tt === "da_thanh_toan"
      ? "bg-lime text-dark"
      : tt === "cod"
        ? "bg-amber-100 text-amber-800"
        : "bg-dark/10 text-dark/60";
  return <span className={`badge ${cls}`}>{THANH_TOAN_LABEL[tt] ?? tt}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card ${accent ? "bg-dark text-paper" : ""}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-paper/60" : "text-dark/50"}`}>
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold">{value}</div>
      {sub && (
        <div className={`mt-0.5 text-xs ${accent ? "text-paper/60" : "text-dark/50"}`}>{sub}</div>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-dark/40">{children}</p>;
}
