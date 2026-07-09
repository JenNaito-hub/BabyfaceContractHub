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
