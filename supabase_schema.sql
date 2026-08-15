-- ============================================================
-- Babyface Talent Manager — Supabase schema + RLS
-- Chạy trong Supabase SQL Editor (project nmgqpirrvzzysgxybccd)
-- Nguyên tắc: SĐT tách bảng riêng (chỉ admin/manager đọc);
--            talent mới = pending, phải duyệt tay mới approved.
-- Idempotent: chạy lại nhiều lần không lỗi. An toàn khi project
-- đã có sẵn bảng profiles (dùng chung với Prompt Studio).
-- ============================================================

-- ---------- 0. Enum role ----------
do $$ begin
  create type user_role as enum ('admin','manager','staff');
exception when duplicate_object then null; end $$;

-- ---------- 1. profiles (map tới auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'staff',
  created_at timestamptz default now()
);
-- Nếu project đã có sẵn bảng profiles (vd dùng chung với Prompt Studio),
-- bổ sung cột còn thiếu để tránh lỗi "column role does not exist".
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role user_role not null default 'staff';
alter table public.profiles add column if not exists created_at timestamptz default now();

-- helper: role của user hiện tại
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() in ('admin','manager'), false)
$$;

-- ---------- 2. talents (KHÔNG chứa SĐT) ----------
create table if not exists public.talents (
  id uuid primary key default gen_random_uuid(),
  ho_ten text not null,
  gioi_tinh text,
  phan_loai text,
  chieu_cao text,
  can_nang text,
  so_do text,
  facebook text,
  instagram text,
  ghi_chu text,
  status text not null default 'pending' check (status in ('pending','approved')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ---------- 3. talent_contacts (SĐT — NHẠY CẢM) ----------
create table if not exists public.talent_contacts (
  talent_id uuid primary key references public.talents(id) on delete cascade,
  sdt text,
  email text,
  ghi_chu_lien_he text,
  updated_at timestamptz default now()
);

-- ---------- 4. jobs ----------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  thang text not null,                    -- 'YYYY-MM'
  ten_job text not null,
  khach_hang text,
  ngay_shooting text,
  dia_diem text,
  pm text,
  created_at timestamptz default now()
);
create index if not exists jobs_thang_idx on public.jobs(thang);

-- ---------- 5. castings (talent <-> job) ----------
create table if not exists public.castings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  talent_id uuid not null references public.talents(id) on delete cascade,
  vai text,
  ket_qua text not null default 'Không đậu' check (ket_qua in ('Đậu','Không đậu')),
  so_tien_hd bigint default 0,
  co_ot text default 'Không' check (co_ot in ('Có','Không')),
  chi_phi_ot bigint default 0,
  ghi_chu text,
  created_at timestamptz default now()
);
create index if not exists castings_job_idx on public.castings(job_id);
create index if not exists castings_talent_idx on public.castings(talent_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.talents         enable row level security;
alter table public.talent_contacts enable row level security;
alter table public.jobs            enable row level security;
alter table public.castings        enable row level security;

-- profiles: user đọc chính mình; manager đọc tất cả
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_manager());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- talents: mọi user đã đăng nhập đọc & thêm; sửa thì tự tạo hoặc manager;
--          đổi status (duyệt) chỉ manager (enforce ở app + policy update)
drop policy if exists talents_read on public.talents;
create policy talents_read on public.talents
  for select using (auth.role() = 'authenticated');
drop policy if exists talents_insert on public.talents;
create policy talents_insert on public.talents
  for insert with check (auth.role() = 'authenticated');
drop policy if exists talents_update on public.talents;
create policy talents_update on public.talents
  for update using (created_by = auth.uid() or public.is_manager());
drop policy if exists talents_delete on public.talents;
create policy talents_delete on public.talents
  for delete using (public.is_manager());

-- talent_contacts: CHỈ manager/admin đọc & ghi (SĐT nhạy cảm)
drop policy if exists contacts_manager_read on public.talent_contacts;
create policy contacts_manager_read on public.talent_contacts
  for select using (public.is_manager());
drop policy if exists contacts_manager_write on public.talent_contacts;
create policy contacts_manager_write on public.talent_contacts
  for all using (public.is_manager()) with check (public.is_manager());

-- jobs: authenticated đọc/ghi; xoá manager
drop policy if exists jobs_read on public.jobs;
create policy jobs_read on public.jobs
  for select using (auth.role() = 'authenticated');
drop policy if exists jobs_write on public.jobs;
create policy jobs_write on public.jobs
  for insert with check (auth.role() = 'authenticated');
drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update using (auth.role() = 'authenticated');
drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete using (public.is_manager());

-- castings: authenticated đọc/ghi/sửa; xoá manager
drop policy if exists castings_read on public.castings;
create policy castings_read on public.castings
  for select using (auth.role() = 'authenticated');
drop policy if exists castings_write on public.castings;
create policy castings_write on public.castings
  for insert with check (auth.role() = 'authenticated');
drop policy if exists castings_update on public.castings;
create policy castings_update on public.castings
  for update using (auth.role() = 'authenticated');
drop policy if exists castings_delete on public.castings;
create policy castings_delete on public.castings
  for delete using (public.is_manager());

-- ============================================================
-- Tạo profile tự động khi có user mới (mặc định role staff)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'staff')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Sau khi chạy: vào bảng profiles nâng account của Jen lên 'admin':
--   update public.profiles set role='admin' where id = '<uuid cua Jen>';
-- Hoặc theo email:
--   update public.profiles set role='admin'
--   where id = (select id from auth.users where email = 'jen.aescentic@gmail.com');
-- ============================================================

-- ============================================================
-- v2 — Tính năng đặc thù talent/casting (phần mềm bán lẻ như
-- nhanh.vn không có): lịch & chống trùng lịch, thanh toán cát-xê
-- + thuế TNCN, đánh giá/blacklist talent, audit log.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- ============================================================

-- ---------- v2.1 talents: blacklist ----------
alter table public.talents add column if not exists is_blacklisted boolean not null default false;
alter table public.talents add column if not exists ly_do_blacklist text;
alter table public.talents add column if not exists blacklisted_by uuid references auth.users(id);
alter table public.talents add column if not exists blacklisted_at timestamptz;

-- ---------- v2.2 jobs: ngày shooting dạng date (cho lịch) ----------
-- Giữ nguyên cột text `ngay_shooting` (hiển thị tự do, vd '12-14/07').
-- Thêm 2 cột date để dựng lịch & phát hiện trùng lịch.
alter table public.jobs add column if not exists ngay_bat_dau date;
alter table public.jobs add column if not exists ngay_ket_thuc date;
alter table public.jobs add column if not exists call_time text;
create index if not exists jobs_ngay_bat_dau_idx on public.jobs(ngay_bat_dau);

-- Backfill best-effort từ text cũ: chỉ nhận dạng ISO 'YYYY-MM-DD'.
-- Các định dạng tự do khác ('12/07', '12-14/07') để trống, nhập lại bằng tay.
update public.jobs
   set ngay_bat_dau = ngay_shooting::date
 where ngay_bat_dau is null
   and ngay_shooting ~ '^\d{4}-\d{2}-\d{2}$';

-- ---------- v2.3 castings: thanh toán cát-xê + thuế TNCN ----------
alter table public.castings add column if not exists trang_thai_tt text not null default 'Chưa trả';
alter table public.castings add column if not exists ngay_thanh_toan date;
alter table public.castings add column if not exists phuong_thuc_tt text;
alter table public.castings add column if not exists khau_tru_thue bigint not null default 0;
alter table public.castings add column if not exists paid_by uuid references auth.users(id);

do $$ begin
  alter table public.castings
    add constraint castings_trang_thai_tt_check
    check (trang_thai_tt in ('Chưa trả','Đã trả'));
exception when duplicate_object then null; end $$;

create index if not exists castings_trang_thai_tt_idx on public.castings(trang_thai_tt);

-- ---------- v2.4 talent_ratings: đánh giá sau job ----------
create table if not exists public.talent_ratings (
  id uuid primary key default gen_random_uuid(),
  casting_id uuid not null unique references public.castings(id) on delete cascade,
  talent_id uuid not null references public.talents(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  diem smallint not null check (diem between 1 and 5),
  de_xuat text not null default 'Nên dùng lại'
    check (de_xuat in ('Nên dùng lại','Cân nhắc','Không dùng lại')),
  ghi_chu text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists talent_ratings_talent_idx on public.talent_ratings(talent_id);
create index if not exists talent_ratings_job_idx on public.talent_ratings(job_id);

-- ---------- v2.5 audit_logs ----------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  changed jsonb,
  created_at timestamptz default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_table_idx on public.audit_logs(table_name);

-- Trigger ghi log. SECURITY DEFINER nên ghi được kể cả khi bảng bật RLS.
-- QUAN TRỌNG: với talent_contacts chỉ log TÊN CỘT thay đổi, KHÔNG log giá trị
-- (tránh rò SĐT vào bảng log).
create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec_id text;
  diff jsonb := '{}'::jsonb;
  k text;
  old_j jsonb;
  new_j jsonb;
  mask boolean := (tg_table_name = 'talent_contacts');
begin
  if tg_op = 'DELETE' then
    old_j := to_jsonb(old);
    rec_id := coalesce(old_j->>'id', old_j->>'talent_id');
    diff := case when mask then '{"masked": true}'::jsonb else old_j end;
  elsif tg_op = 'INSERT' then
    new_j := to_jsonb(new);
    rec_id := coalesce(new_j->>'id', new_j->>'talent_id');
    diff := case when mask then '{"masked": true}'::jsonb else new_j end;
  else
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    rec_id := coalesce(new_j->>'id', new_j->>'talent_id');
    for k in select jsonb_object_keys(new_j) loop
      if (new_j->k) is distinct from (old_j->k) and k <> 'updated_at' then
        if mask then
          diff := diff || jsonb_build_object(k, 'đã thay đổi');
        else
          diff := diff || jsonb_build_object(k, jsonb_build_array(old_j->k, new_j->k));
        end if;
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;   -- không có gì đổi thật -> không ghi log
    end if;
  end if;

  insert into public.audit_logs (actor_id, table_name, record_id, action, changed)
  values (auth.uid(), tg_table_name, rec_id, tg_op, diff);

  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists audit_talents on public.talents;
create trigger audit_talents after insert or update or delete on public.talents
  for each row execute function public.log_audit();

drop trigger if exists audit_castings on public.castings;
create trigger audit_castings after insert or update or delete on public.castings
  for each row execute function public.log_audit();

drop trigger if exists audit_jobs on public.jobs;
create trigger audit_jobs after insert or update or delete on public.jobs
  for each row execute function public.log_audit();

drop trigger if exists audit_talent_contacts on public.talent_contacts;
create trigger audit_talent_contacts after insert or update or delete on public.talent_contacts
  for each row execute function public.log_audit();

-- ---------- v2.6 RLS cho bảng mới ----------
alter table public.talent_ratings enable row level security;
alter table public.audit_logs     enable row level security;

-- ratings: authenticated đọc & thêm; sửa của mình hoặc manager; xoá manager
drop policy if exists ratings_read on public.talent_ratings;
create policy ratings_read on public.talent_ratings
  for select using (auth.role() = 'authenticated');
drop policy if exists ratings_insert on public.talent_ratings;
create policy ratings_insert on public.talent_ratings
  for insert with check (auth.role() = 'authenticated');
drop policy if exists ratings_update on public.talent_ratings;
create policy ratings_update on public.talent_ratings
  for update using (created_by = auth.uid() or public.is_manager());
drop policy if exists ratings_delete on public.talent_ratings;
create policy ratings_delete on public.talent_ratings
  for delete using (public.is_manager());

-- audit_logs: CHỈ manager/admin đọc. Không ai ghi trực tiếp (chỉ trigger).
drop policy if exists audit_manager_read on public.audit_logs;
create policy audit_manager_read on public.audit_logs
  for select using (public.is_manager());
