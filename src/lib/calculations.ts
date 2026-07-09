import type { Casting, Job } from "./types";

export function formatVND(n: number | null | undefined): string {
  const value = Number(n ?? 0);
  return value.toLocaleString("vi-VN") + " đ";
}

export function formatThang(thang: string): string {
  // 'YYYY-MM' -> 'Tháng MM/YYYY'
  const [y, m] = thang.split("-");
  if (!y || !m) return thang;
  return `Tháng ${m}/${y}`;
}

export function currentThang(): string {
  // Tính theo giờ địa phương của trình duyệt / server
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Tổng tiền của 1 casting (chỉ tính khi Đậu) = so_tien_hd + chi_phi_ot */
export function castingPayout(c: Pick<Casting, "ket_qua" | "so_tien_hd" | "chi_phi_ot">): number {
  if (c.ket_qua !== "Đậu") return 0;
  return Number(c.so_tien_hd ?? 0) + Number(c.chi_phi_ot ?? 0);
}

export type MonthlyStats = {
  luotCasting: number; // tổng số dòng casting
  talentUnique: number; // distinct talent_id
  talentTrung: number; // talent có >=2 job phân biệt
  soDau: number; // số casting kết quả Đậu
  tongHopDong: number; // Σ so_tien_hd của Đậu
  tongOt: number; // Σ chi_phi_ot của Đậu
  tongThanhToan: number; // Σ (so_tien_hd + chi_phi_ot) của Đậu
};

export function computeMonthlyStats(castings: Casting[]): MonthlyStats {
  const talentIds = new Set<string>();
  const talentJobs = new Map<string, Set<string>>();

  let soDau = 0;
  let tongHopDong = 0;
  let tongOt = 0;

  for (const c of castings) {
    talentIds.add(c.talent_id);
    if (!talentJobs.has(c.talent_id)) talentJobs.set(c.talent_id, new Set());
    talentJobs.get(c.talent_id)!.add(c.job_id);

    if (c.ket_qua === "Đậu") {
      soDau += 1;
      tongHopDong += Number(c.so_tien_hd ?? 0);
      tongOt += Number(c.chi_phi_ot ?? 0);
    }
  }

  let talentTrung = 0;
  for (const jobs of talentJobs.values()) {
    if (jobs.size >= 2) talentTrung += 1;
  }

  return {
    luotCasting: castings.length,
    talentUnique: talentIds.size,
    talentTrung,
    soDau,
    tongHopDong,
    tongOt,
    tongThanhToan: tongHopDong + tongOt,
  };
}

export type JobBreakdown = {
  job: Job;
  luotCasting: number;
  soDau: number;
  tongThanhToan: number;
};

export function computeJobBreakdown(jobs: Job[], castings: Casting[]): JobBreakdown[] {
  const byJob = new Map<string, Casting[]>();
  for (const c of castings) {
    if (!byJob.has(c.job_id)) byJob.set(c.job_id, []);
    byJob.get(c.job_id)!.push(c);
  }

  return jobs.map((job) => {
    const list = byJob.get(job.id) ?? [];
    let soDau = 0;
    let tongThanhToan = 0;
    for (const c of list) {
      if (c.ket_qua === "Đậu") {
        soDau += 1;
        tongThanhToan += castingPayout(c);
      }
    }
    return {
      job,
      luotCasting: list.length,
      soDau,
      tongThanhToan,
    };
  });
}
