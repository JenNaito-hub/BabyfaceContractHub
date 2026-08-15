-- ============================================================
-- AESCENTIC OS — Phase 0: Foundation
--
-- Schema riêng `os` để không đụng vào app bán hàng đang chạy ở `public`.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- Chỉ tiến, không lùi.
-- ============================================================

create schema if not exists os;
create extension if not exists "pgcrypto";

-- Hàm dùng chung: tự cập nhật updated_at
create or replace function os.fn_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ============================================================
-- 1. IDENTITY & ACCESS
-- ============================================================

create table if not exists os.users (
  id uuid primary key default gen_random_uuid(),
  -- Xác thực do Supabase Auth lo; đây là bản sao để tham chiếu và phân quyền.
  auth_user_id uuid unique,
  email text not null unique,
  full_name text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  -- Vai trò hệ thống không cho xoá, nhưng vẫn sửa được quyền
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action text not null,
  scope text not null check (scope in ('self','store','department','region','all')),
  description text,
  created_at timestamptz not null default now(),
  unique (resource, action, scope)
);

create table if not exists os.role_permissions (
  role_id uuid not null references os.roles(id) on delete cascade,
  permission_id uuid not null references os.permissions(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references os.users(id),
  primary key (role_id, permission_id)
);

create table if not exists os.user_roles (
  user_id uuid not null references os.users(id) on delete cascade,
  role_id uuid not null references os.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references os.users(id),
  primary key (user_id, role_id)
);

-- ============================================================
-- 2. ORG
-- ============================================================

create table if not exists os.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'store' check (kind in ('store','warehouse','popup','online')),
  region_id uuid references os.regions(id),
  address text,
  province text,
  district text,
  phone text,
  opened_at date,
  is_active boolean not null default true,
  -- Đồng bộ từ Nhanh.vn
  source text not null default 'os',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists stores_source_ref_idx
  on os.stores(source, external_ref) where external_ref is not null;

create table if not exists os.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references os.users(id) on delete set null,
  code text not null unique,
  full_name text not null,
  phone text,
  email text,
  department_id uuid references os.departments(id),
  primary_store_id uuid references os.stores(id),
  job_title text,
  hired_at date,
  terminated_at date,
  is_active boolean not null default true,
  source text not null default 'os',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employees_store_idx on os.employees(primary_store_id);

-- Một người có thể phụ trách nhiều cửa hàng / nhiều vùng
create table if not exists os.user_store_assignments (
  user_id uuid not null references os.users(id) on delete cascade,
  store_id uuid not null references os.stores(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

create table if not exists os.user_region_assignments (
  user_id uuid not null references os.users(id) on delete cascade,
  region_id uuid not null references os.regions(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, region_id)
);

create table if not exists os.user_department_assignments (
  user_id uuid not null references os.users(id) on delete cascade,
  department_id uuid not null references os.departments(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, department_id)
);

-- ============================================================
-- 3. PRODUCT CATALOG (phần tối thiểu cho Phase 0)
-- ============================================================

create table if not exists os.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_id uuid references os.categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.collections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  story text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid references os.categories(id),
  collection_id uuid references os.collections(id),
  description text,
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft','development','approved','launch','active','phase_out','discontinued')),
  source text not null default 'os',
  external_ref text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists products_source_ref_idx
  on os.products(source, external_ref) where external_ref is not null;

create table if not exists os.skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references os.products(id) on delete cascade,
  code text not null unique,
  name text,
  volume_ml integer,
  barcode text,
  weight_gram integer not null default 0,
  -- Tiền luôn là bigint (đồng). Không bao giờ dùng float cho tiền.
  retail_price bigint not null default 0,
  wholesale_price bigint not null default 0,
  reorder_point integer not null default 0,
  is_active boolean not null default true,
  source text not null default 'os',
  external_ref text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists skus_product_idx on os.skus(product_id);
create unique index if not exists skus_source_ref_idx
  on os.skus(source, external_ref) where external_ref is not null;

-- Hồ sơ mùi hương
create table if not exists os.fragrance_profiles (
  product_id uuid primary key references os.products(id) on delete cascade,
  family text,
  top_notes text[],
  middle_notes text[],
  base_notes text[],
  intensity text check (intensity in ('light','moderate','strong','intense')),
  longevity_hours integer,
  seasons text[],
  occasions text[],
  time_of_day text check (time_of_day in ('day','night','both')),
  target_profile text,
  story text,
  selling_points text[],
  updated_at timestamptz not null default now()
);

-- GIÁ VỐN — bảng riêng, bật RLS (lớp phòng thủ thứ hai)
create table if not exists os.product_costs (
  sku_id uuid primary key references os.skus(id) on delete cascade,
  unit_cost bigint not null default 0,
  effective_from timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references os.users(id)
);

-- ============================================================
-- 4. INVENTORY LOCATION
-- Cột managed_by là chốt chặn của rủi ro R1: một địa điểm chỉ có
-- đúng MỘT hệ thống được quyền ghi tồn.
-- ============================================================

create table if not exists os.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  store_id uuid references os.stores(id),
  kind text not null default 'sellable'
    check (kind in ('sellable','tester','gift','damaged','reserved','in_transit')),
  managed_by text not null default 'os' check (managed_by in ('os','nhanh')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inv_loc_store_idx on os.inventory_locations(store_id);

-- ============================================================
-- 5. PLATFORM
-- ============================================================

-- Cấu hình có phiên bản theo thời gian. Không hard-code bất kỳ ngưỡng nào.
create table if not exists os.config_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  scope_type text not null default 'global'
    check (scope_type in ('global','store','department','role')),
  scope_id uuid,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references os.users(id),
  constraint config_khoang_hop_le check (effective_to is null or effective_to > effective_from)
);
create index if not exists config_key_idx on os.config_settings(key, scope_type, scope_id, effective_from desc);

-- Audit bắt buộc cho: tiền, kho, lương, quyền, hợp đồng
create table if not exists os.audit_log (
  id bigserial primary key,
  actor_user_id uuid references os.users(id),
  actor_label text,
  event text not null,
  entity_type text not null,
  entity_id text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  approver_user_id uuid references os.users(id),
  request_id text,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists audit_entity_idx on os.audit_log(entity_type, entity_id, created_at desc);
create index if not exists audit_actor_idx on os.audit_log(actor_user_id, created_at desc);
create index if not exists audit_event_idx on os.audit_log(event, created_at desc);

-- Outbox: domain event ghi cùng transaction nghiệp vụ, worker đọc sau.
create table if not exists os.domain_events (
  id bigserial primary key,
  name text not null,
  payload jsonb not null,
  entity_type text,
  entity_id text,
  actor_user_id uuid references os.users(id),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists events_chua_xu_ly_idx
  on os.domain_events(occurred_at) where processed_at is null;

create table if not exists os.integration_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null,
  is_active boolean not null default true,
  -- KHÔNG lưu secret ở đây. Secret nằm ở biến môi trường.
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, label)
);

create table if not exists os.integration_sync_state (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  resource text not null,
  cursor text,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  records_synced bigint not null default 0,
  consecutive_failures integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (provider, resource)
);

-- ============================================================
-- 6. TRIGGER updated_at
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','roles','regions','departments','stores','employees','categories',
    'collections','products','skus','inventory_locations','integration_accounts'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on os.%1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on os.%1$I
       for each row execute function os.fn_touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- 7. RLS — lớp phòng thủ thứ hai cho dữ liệu nhạy cảm
-- Service layer là nơi chặn chính; đây là lưới an toàn nếu service có lỗ.
-- ============================================================
alter table os.product_costs enable row level security;

drop policy if exists product_costs_no_anon on os.product_costs;
create policy product_costs_no_anon on os.product_costs
  for all using (false) with check (false);

comment on policy product_costs_no_anon on os.product_costs is
  'Chặn mọi truy cập qua PostgREST/anon key. Giá vốn chỉ đọc được từ server layer
   dùng service role, sau khi đã kiểm quyền product.cost.read.';
