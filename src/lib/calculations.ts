import type { Casting, Job, TalentRating } from "./types";

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

// ============================================================
// v2 — Thanh toán cát-xê + thuế TNCN
// ============================================================

/** Ngưỡng khấu trừ thuế TNCN 10% cho cá nhân không ký HĐLĐ (Thông tư 111/2013). */
export const NGUONG_KHAU_TRU = 2_000_000;
export const THUE_SUAT_TNCN = 0.1;

/**
 * Số thuế TNCN 10% gợi ý cho 1 casting.
 * Chỉ khấu trừ khi tổng chi trả >= 2 triệu. Talent có cam kết thu nhập
 * dưới ngưỡng chịu thuế thì để 0 (sửa tay trong bảng thanh toán).
 */
export function suggestKhauTruThue(payout: number): number {
  if (payout < NGUONG_KHAU_TRU) return 0;
  return Math.round(payout * THUE_SUAT_TNCN);
}

/** Talent thực nhận = (tiền HĐ + OT) − thuế đã khấu trừ. */
export function netPayout(
  c: Pick<Casting, "ket_qua" | "so_tien_hd" | "chi_phi_ot" | "khau_tru_thue">,
): number {
  const gross = castingPayout(c);
  if (gross === 0) return 0;
  return Math.max(0, gross - Number(c.khau_tru_thue ?? 0));
}

export type PaymentStats = {
  soDong: number; // số casting Đậu (có phát sinh chi trả)
  tongGross: number; // Σ tiền HĐ + OT
  tongThue: number; // Σ thuế khấu trừ
  tongNet: number; // Σ thực nhận
  daTraNet: number; // đã trả (thực nhận)
  conNoNet: number; // còn phải trả (thực nhận)
  soDongChuaTra: number;
};

export function computePaymentStats(castings: Casting[]): PaymentStats {
  let soDong = 0;
  let tongGross = 0;
  let tongThue = 0;
  let daTraNet = 0;
  let soDongChuaTra = 0;

  for (const c of castings) {
    if (c.ket_qua !== "Đậu") continue;
    soDong += 1;
    tongGross += castingPayout(c);
    tongThue += Number(c.khau_tru_thue ?? 0);
    if (c.trang_thai_tt === "Đã trả") {
      daTraNet += netPayout(c);
    } else {
      soDongChuaTra += 1;
    }
  }

  const tongNet = Math.max(0, tongGross - tongThue);
  return {
    soDong,
    tongGross,
    tongThue,
    tongNet,
    daTraNet,
    conNoNet: Math.max(0, tongNet - daTraNet),
    soDongChuaTra,
  };
}

// ============================================================
// v2 — Lịch shooting & chống trùng lịch
// ============================================================

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'. Trả nguyên chuỗi nếu không đúng định dạng. */
export function formatNgay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Các ngày job chiếm dụng talent: từ `ngay_bat_dau` tới `ngay_ket_thuc`
 * (bao gồm 2 đầu). Job chưa điền ngày -> mảng rỗng, không tính vào lịch.
 * Chặn trên 60 ngày để dữ liệu nhập sai không làm treo UI.
 */
export function jobDates(job: Pick<Job, "ngay_bat_dau" | "ngay_ket_thuc">): string[] {
  const start = job.ngay_bat_dau;
  if (!start) return [];
  const end = job.ngay_ket_thuc && job.ngay_ket_thuc >= start ? job.ngay_ket_thuc : start;
  const out: string[] = [];
  let cur = start;
  while (cur <= end && out.length < 60) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

export type ScheduleConflict = {
  talentId: string;
  ngay: string; // 'YYYY-MM-DD'
  jobs: Job[]; // >= 2 job trùng ngày
};

/**
 * Talent bị đặt 2+ job khác nhau trong cùng 1 ngày.
 * Chỉ xét casting `Đậu` (đã chốt lịch) — casting chưa có kết quả thì
 * chưa chiếm lịch nên không cảnh báo.
 */
export function findScheduleConflicts(jobs: Job[], castings: Casting[]): ScheduleConflict[] {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  // talentId -> ngày -> set(jobId)
  const busy = new Map<string, Map<string, Set<string>>>();

  for (const c of castings) {
    if (c.ket_qua !== "Đậu") continue;
    const job = jobById.get(c.job_id);
    if (!job) continue;
    for (const ngay of jobDates(job)) {
      if (!busy.has(c.talent_id)) busy.set(c.talent_id, new Map());
      const byDay = busy.get(c.talent_id)!;
      if (!byDay.has(ngay)) byDay.set(ngay, new Set());
      byDay.get(ngay)!.add(job.id);
    }
  }

  const out: ScheduleConflict[] = [];
  for (const [talentId, byDay] of busy) {
    for (const [ngay, jobIds] of byDay) {
      if (jobIds.size < 2) continue;
      out.push({
        talentId,
        ngay,
        jobs: Array.from(jobIds)
          .map((id) => jobById.get(id))
          .filter((j): j is Job => !!j),
      });
    }
  }
  return out.sort((a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0));
}

// ============================================================
// v2 — Tìm talent theo hình thể
// ============================================================

/**
 * Đọc chiều cao/cân nặng nhập tự do ra số.
 * Nhận: '170', '1m70', '1.70', '170cm', '55 kg'. Không đọc được -> null.
 */
export function parseSoDo(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/,/g, ".");

  // '1m70' / '1m7'
  const m = /(\d)\s*m\s*(\d{1,2})/.exec(s);
  if (m) {
    const cm = Number(m[2].length === 1 ? m[2] + "0" : m[2]);
    return Number(m[1]) * 100 + cm;
  }

  const n = /(\d+(?:\.\d+)?)/.exec(s);
  if (!n) return null;
  const value = Number(n[1]);
  if (!Number.isFinite(value)) return null;

  // '1.70' m -> 170 cm
  if (value > 0 && value < 3) return Math.round(value * 100);
  return value;
}

export type RatingAggregate = { soDanhGia: number; diemTb: number };

export function computeRatingAggregates(
  ratings: Pick<TalentRating, "talent_id" | "diem">[],
): Record<string, RatingAggregate> {
  const sum = new Map<string, { total: number; count: number }>();
  for (const r of ratings) {
    const cur = sum.get(r.talent_id) ?? { total: 0, count: 0 };
    cur.total += Number(r.diem ?? 0);
    cur.count += 1;
    sum.set(r.talent_id, cur);
  }
  const out: Record<string, RatingAggregate> = {};
  for (const [id, v] of sum) {
    out[id] = { soDanhGia: v.count, diemTb: v.count ? v.total / v.count : 0 };
  }
  return out;
}
