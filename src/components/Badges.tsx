import type { KetQua, TalentStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: TalentStatus }) {
  if (status === "approved") {
    return <span className="badge bg-lime text-dark">Đã duyệt</span>;
  }
  return <span className="badge bg-warning/15 text-warning">Chờ duyệt</span>;
}

export function KetQuaBadge({ ketQua }: { ketQua: KetQua }) {
  if (ketQua === "Đậu") {
    return <span className="badge bg-lime text-dark">Đậu</span>;
  }
  return <span className="badge bg-dark/10 text-dark/60">Không đậu</span>;
}
