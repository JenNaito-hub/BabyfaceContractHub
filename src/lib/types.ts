export type UserRole = "admin" | "manager" | "staff";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  email: string | null;
  /** Cửa hàng được gán (app bán hàng) — null nếu làm ở văn phòng/nhiều nơi. */
  store_id: string | null;
  created_at: string;
};

export type TalentStatus = "pending" | "approved";

export type Talent = {
  id: string;
  ho_ten: string;
  gioi_tinh: string | null;
  phan_loai: string | null;
  chieu_cao: string | null;
  can_nang: string | null;
  so_do: string | null;
  facebook: string | null;
  instagram: string | null;
  ghi_chu: string | null;
  status: TalentStatus;
  created_by: string | null;
  created_at: string;
};

export type TalentContact = {
  talent_id: string;
  sdt: string | null;
  email: string | null;
  ghi_chu_lien_he: string | null;
  updated_at: string;
};

export type Job = {
  id: string;
  thang: string; // 'YYYY-MM'
  ten_job: string;
  khach_hang: string | null;
  ngay_shooting: string | null;
  dia_diem: string | null;
  pm: string | null;
  created_at: string;
};

export type KetQua = "Đậu" | "Không đậu";
export type CoOt = "Có" | "Không";

export type Casting = {
  id: string;
  job_id: string;
  talent_id: string;
  vai: string | null;
  ket_qua: KetQua;
  so_tien_hd: number;
  co_ot: CoOt;
  chi_phi_ot: number;
  ghi_chu: string | null;
  created_at: string;
};

export type CastingWithTalent = Casting & {
  talent: Pick<Talent, "id" | "ho_ten" | "status"> | null;
};

export type CastingWithJob = Casting & {
  job: Job | null;
};

export function isManagerRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "manager";
}
