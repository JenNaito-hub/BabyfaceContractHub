export type UserRole = "admin" | "manager" | "staff";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
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
  is_blacklisted: boolean;
  ly_do_blacklist: string | null;
  blacklisted_by: string | null;
  blacklisted_at: string | null;
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
  ngay_bat_dau: string | null; // 'YYYY-MM-DD' — dùng cho lịch & chống trùng
  ngay_ket_thuc: string | null; // 'YYYY-MM-DD' — job nhiều ngày
  call_time: string | null;
  dia_diem: string | null;
  pm: string | null;
  created_at: string;
};

export type KetQua = "Đậu" | "Không đậu";
export type CoOt = "Có" | "Không";
export type TrangThaiTT = "Chưa trả" | "Đã trả";
export type PhuongThucTT = "Tiền mặt" | "Chuyển khoản" | "Ví điện tử";

export const PHUONG_THUC_TT: PhuongThucTT[] = ["Tiền mặt", "Chuyển khoản", "Ví điện tử"];

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
  trang_thai_tt: TrangThaiTT;
  ngay_thanh_toan: string | null;
  phuong_thuc_tt: PhuongThucTT | null;
  khau_tru_thue: number;
  paid_by: string | null;
  created_at: string;
};

export type DeXuat = "Nên dùng lại" | "Cân nhắc" | "Không dùng lại";

export const DE_XUAT: DeXuat[] = ["Nên dùng lại", "Cân nhắc", "Không dùng lại"];

export type TalentRating = {
  id: string;
  casting_id: string;
  talent_id: string;
  job_id: string;
  diem: number; // 1..5
  de_xuat: DeXuat;
  ghi_chu: string | null;
  created_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed: Record<string, unknown> | null;
  created_at: string;
};

export type CastingWithTalent = Casting & {
  talent: Pick<Talent, "id" | "ho_ten" | "status"> | null;
};

export type CastingWithJob = Casting & {
  job: Job | null;
};

export type CastingFull = Casting & {
  talent: Pick<Talent, "id" | "ho_ten" | "status"> | null;
  job: Job | null;
};

export function isManagerRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "manager";
}
