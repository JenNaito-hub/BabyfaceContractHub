import * as XLSX from "xlsx";
import type { Casting, Job } from "./types";
import {
  castingPayout,
  computeJobBreakdown,
  computeMonthlyStats,
  formatThang,
} from "./calculations";

/**
 * Xuất báo cáo 1 tháng ra file .xlsx (client-side, SheetJS).
 * 3 sheet: Tổng quan, Theo job, Chi tiết casting.
 */
export function exportMonthToExcel(
  thang: string,
  jobs: Job[],
  castings: Casting[],
  talentNames: Record<string, string> = {},
) {
  const stats = computeMonthlyStats(castings);
  const breakdown = computeJobBreakdown(jobs, castings);
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const wb = XLSX.utils.book_new();

  // Sheet 1 — Tổng quan
  const summary = [
    ["Báo cáo tháng", formatThang(thang)],
    [],
    ["Lượt casting", stats.luotCasting],
    ["Talent unique", stats.talentUnique],
    ["Talent >=2 job", stats.talentTrung],
    ["Số đậu", stats.soDau],
    ["Tổng hợp đồng", stats.tongHopDong],
    ["Tổng OT", stats.tongOt],
    ["Tổng thanh toán", stats.tongThanhToan],
    ["Số job", jobs.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Tong quan");

  // Sheet 2 — Theo job
  const jobRows = [
    ["Job", "Khách hàng", "Ngày", "PM", "Lượt casting", "Đậu", "Thanh toán"],
    ...breakdown.map((b) => [
      b.job.ten_job,
      b.job.khach_hang ?? "",
      b.job.ngay_shooting ?? "",
      b.job.pm ?? "",
      b.luotCasting,
      b.soDau,
      b.tongThanhToan,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(jobRows), "Theo job");

  // Sheet 3 — Chi tiết casting
  const detailRows = [
    ["Job", "Talent", "Vai", "Kết quả", "Tiền HĐ", "Có OT", "Chi phí OT", "Thanh toán", "Ghi chú"],
    ...castings.map((c) => {
      const job = jobById.get(c.job_id);
      return [
        job?.ten_job ?? "",
        talentNames[c.talent_id] ?? c.talent_id,
        c.vai ?? "",
        c.ket_qua,
        c.so_tien_hd,
        c.co_ot,
        c.chi_phi_ot,
        castingPayout(c),
        c.ghi_chu ?? "",
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Chi tiet casting");

  XLSX.writeFile(wb, `bao-cao-${thang}.xlsx`);
}
