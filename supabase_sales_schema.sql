-- ============================================================
-- AESCENTIC SALES — Supabase schema + RLS + triggers
-- Chạy trong Supabase SQL Editor (dán toàn bộ file → Run).
-- Idempotent: chạy lại nhiều lần không lỗi.
--
-- Nguyên tắc:
--   1. Tồn kho KHÔNG bao giờ sửa tay — chỉ đổi qua trigger/RPC,
--      mỗi lần đổi đều ghi 1 dòng sổ ở stock_moves (audit trail).
--   2. GIÁ VỐN tách bảng riêng (variant_costs / order_item_costs),
--      RLS chỉ admin/manager đọc → staff không thấy lãi lỗ.
--   3. Bật RLS trên MỌI bảng.
-- ============================================================

-- ---------- 0. profiles + helper role (dùng chung với Talent Manager) ----------
do $$ begin
  create type user_role as enum ('admin','manager','staff');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'staff',
  created_at timestamptz default now()
);
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role user_role not null default 'staff';
alter table public.profiles add column if not exists created_at timestamptz default now();
-- Nhân viên được gán về 1 cửa hàng (POS mặc định bán ở cửa hàng này)
alter table public.profiles add column if not exists store_id uuid;
-- Email hiển thị trong màn hình phân quyền (auth.users không đọc được từ client)
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() in ('admin','manager'), false)
$$;

-- Giữ email trong profiles luôn khớp auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, 'staff')
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chặn tự nâng quyền: chỉ admin mới đổi được role / store_id của bất kỳ ai.
-- (Policy update cho phép user sửa hồ sơ của chính mình — trigger này chặn
--  phần nhạy cảm, kể cả khi gọi thẳng API.)
create or replace function public.fn_guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() null = đang chạy từ SQL Editor / service role (setup ban đầu) → cho phép
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.store_id is distinct from old.store_id)
     and coalesce(public.current_role(), 'staff') <> 'admin' then
    raise exception 'Chỉ admin mới được đổi quyền hoặc cửa hàng của tài khoản';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.fn_guard_profile_role();

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_manager());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- Admin sửa được hồ sơ người khác (gán cửa hàng, đổi role)
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ---------- 1. stores (5 cửa hàng + kho online) ----------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  ma text not null unique,
  ten text not null,
  loai text not null default 'store' check (loai in ('store','warehouse')),
  dia_chi text,
  sdt text,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.profiles
  drop constraint if exists profiles_store_id_fkey;
alter table public.profiles
  add constraint profiles_store_id_fkey
  foreign key (store_id) references public.stores(id) on delete set null;

-- Seed lần đầu: 1 kho online + 5 cửa hàng (đổi tên lại trong Cài đặt)
insert into public.stores (ma, ten, loai)
select * from (values
  ('ONLINE', 'Kho Online (sàn + website)', 'warehouse'),
  ('S1', 'Cửa hàng 1', 'store'),
  ('S2', 'Cửa hàng 2', 'store'),
  ('S3', 'Cửa hàng 3', 'store'),
  ('S4', 'Cửa hàng 4', 'store'),
  ('S5', 'Cửa hàng 5', 'store')
) as v(ma, ten, loai)
on conflict (ma) do nothing;

-- ---------- 2. products + variants ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  dong_san_pham text,                       -- dòng/collection
  mo_ta text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- 1 sản phẩm nhiều biến thể: mùi × dung tích
create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  ten_bien_the text,                        -- vd "Vanilla 50ml"
  dung_tich_ml int,
  barcode text,
  gia_ban bigint not null default 0,        -- giá lẻ
  gia_si bigint not null default 0,         -- giá sỉ / đại lý
  ton_toi_thieu int not null default 0,     -- ngưỡng cảnh báo hết hàng
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists variants_product_idx on public.variants(product_id);
create index if not exists variants_sku_idx on public.variants(sku);

-- GIÁ VỐN — bảng riêng, chỉ manager đọc
create table if not exists public.variant_costs (
  variant_id uuid primary key references public.variants(id) on delete cascade,
  gia_von bigint not null default 0,
  updated_at timestamptz default now()
);

-- ---------- 3. tồn kho + sổ kho ----------
create table if not exists public.inventory (
  variant_id uuid not null references public.variants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  so_luong int not null default 0,
  updated_at timestamptz default now(),
  primary key (variant_id, store_id)
);

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  delta int not null,                       -- + nhập / - xuất
  loai text not null,                       -- nhap | ban | tra | chuyen_di | chuyen_den | kiem_ke | huy
  ref_type text,                            -- order | receipt | transfer | adjust
  ref_id uuid,
  ghi_chu text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists stock_moves_variant_idx on public.stock_moves(variant_id, created_at desc);
create index if not exists stock_moves_ref_idx on public.stock_moves(ref_type, ref_id);

-- Hàm lõi: mọi thay đổi tồn kho đi qua đây (definer → bỏ qua RLS của inventory)
create or replace function public.fn_apply_move(
  p_variant uuid, p_store uuid, p_delta int, p_loai text,
  p_ref_type text, p_ref_id uuid, p_ghi_chu text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_delta = 0 then return; end if;

  insert into public.inventory (variant_id, store_id, so_luong)
  values (p_variant, p_store, p_delta)
  on conflict (variant_id, store_id)
  do update set so_luong = public.inventory.so_luong + excluded.so_luong,
                updated_at = now();

  insert into public.stock_moves (variant_id, store_id, delta, loai, ref_type, ref_id, ghi_chu, created_by)
  values (p_variant, p_store, p_delta, p_loai, p_ref_type, p_ref_id, p_ghi_chu, auth.uid());
end $$;

-- Điều chỉnh tồn về đúng số đếm thực tế (kiểm kho)
create or replace function public.dieu_chinh_ton(
  p_variant uuid, p_store uuid, p_so_luong_thuc int, p_ly_do text default null
) returns int language plpgsql security definer set search_path = public as $$
declare v_hien_tai int; v_delta int;
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý mới được điều chỉnh tồn kho';
  end if;

  select coalesce(so_luong, 0) into v_hien_tai
  from public.inventory where variant_id = p_variant and store_id = p_store;
  v_hien_tai := coalesce(v_hien_tai, 0);
  v_delta := p_so_luong_thuc - v_hien_tai;

  perform public.fn_apply_move(p_variant, p_store, v_delta, 'kiem_ke', 'adjust', null,
                               coalesce(p_ly_do, 'Kiểm kho'));
  return v_delta;
end $$;

-- ---------- 4. khách hàng ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  ho_ten text not null,
  sdt text unique,
  email text,
  dia_chi text,
  nhom text not null default 'le' check (nhom in ('le','si','vip')),
  ghi_chu text,
  created_at timestamptz default now()
);
create index if not exists customers_sdt_idx on public.customers(sdt);

-- ---------- 5. đơn hàng ----------
create sequence if not exists public.order_seq;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ma_don text not null unique
    default 'AE' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
            || '-' || lpad(nextval('public.order_seq')::text, 4, '0'),
  kenh text not null default 'store'
    check (kenh in ('shopee','tiktok','facebook','website','store')),
  store_id uuid not null references public.stores(id),
  customer_id uuid references public.customers(id) on delete set null,
  khach_ten text,
  khach_sdt text,
  dia_chi text,
  trang_thai text not null default 'moi'
    check (trang_thai in ('moi','da_xac_nhan','dang_giao','hoan_thanh','huy','hoan')),
  thanh_toan text not null default 'chua'
    check (thanh_toan in ('chua','cod','da_thanh_toan')),
  tam_tinh bigint not null default 0,
  giam_gia bigint not null default 0,
  phi_ship bigint not null default 0,
  tong_tien bigint not null default 0,
  don_vi_van_chuyen text,
  ma_van_don text,
  ma_don_san text,                          -- mã đơn gốc bên Shopee/TikTok
  ngay_dat timestamptz not null default now(),
  ghi_chu text,
  da_tru_kho boolean not null default false,
  -- Đơn lịch sử import từ sàn: doanh thu vẫn tính, nhưng KHÔNG đụng vào tồn kho
  -- (hàng đã xuất ngoài hệ thống rồi).
  bo_qua_kho boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.orders add column if not exists bo_qua_kho boolean not null default false;
create index if not exists orders_ngay_idx on public.orders(ngay_dat desc);
create index if not exists orders_kenh_idx on public.orders(kenh);
create index if not exists orders_store_idx on public.orders(store_id);
create index if not exists orders_trangthai_idx on public.orders(trang_thai);
create unique index if not exists orders_ma_don_san_idx
  on public.orders(kenh, ma_don_san) where ma_don_san is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete set null,
  sku text,
  ten_hien_thi text,
  so_luong int not null default 1 check (so_luong > 0),
  don_gia bigint not null default 0,
  giam_gia bigint not null default 0,
  created_at timestamptz default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- GIÁ VỐN chốt tại thời điểm bán — bảng riêng, chỉ manager đọc
create table if not exists public.order_item_costs (
  order_item_id uuid primary key references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  gia_von bigint not null default 0
);
create index if not exists order_item_costs_order_idx on public.order_item_costs(order_id);

-- ---------- 6. phiếu nhập kho ----------
create sequence if not exists public.receipt_seq;

create table if not exists public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  ma_phieu text not null unique
    default 'PN' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
            || '-' || lpad(nextval('public.receipt_seq')::text, 4, '0'),
  store_id uuid not null references public.stores(id),
  nha_cung_cap text,
  trang_thai text not null default 'nhap' check (trang_thai in ('nhap','hoan_thanh')),
  ngay date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  ghi_chu text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.stock_receipts(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  so_luong int not null default 1 check (so_luong > 0),
  gia_nhap bigint not null default 0
);
create index if not exists receipt_items_receipt_idx on public.receipt_items(receipt_id);

-- ---------- 7. phiếu chuyển kho ----------
create sequence if not exists public.transfer_seq;

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  ma_phieu text not null unique
    default 'CK' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
            || '-' || lpad(nextval('public.transfer_seq')::text, 4, '0'),
  from_store uuid not null references public.stores(id),
  to_store uuid not null references public.stores(id),
  trang_thai text not null default 'nhap'
    check (trang_thai in ('nhap','dang_chuyen','da_nhan','huy')),
  ngay date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  ghi_chu text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  constraint transfers_khac_kho check (from_store <> to_store)
);

create table if not exists public.transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  so_luong int not null default 1 check (so_luong > 0)
);
create index if not exists transfer_items_transfer_idx on public.transfer_items(transfer_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 7.1 Tính lại tổng tiền đơn mỗi khi dòng hàng đổi
create or replace function public.fn_recalc_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_tam bigint;
begin
  v_order := coalesce(new.order_id, old.order_id);

  select coalesce(sum(so_luong * don_gia - giam_gia), 0) into v_tam
  from public.order_items where order_id = v_order;

  update public.orders
  set tam_tinh = v_tam,
      tong_tien = v_tam - giam_gia + phi_ship
  where id = v_order;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_order on public.order_items;
create trigger trg_recalc_order
  after insert or update or delete on public.order_items
  for each row execute function public.fn_recalc_order();

-- 7.2 Khoá dòng hàng khi đơn đã trừ kho
create or replace function public.fn_guard_order_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_locked boolean;
begin
  select da_tru_kho into v_locked
  from public.orders where id = coalesce(new.order_id, old.order_id);

  if coalesce(v_locked, false) then
    raise exception 'Đơn đã trừ kho — chuyển đơn về "Mới" trước khi sửa hàng';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_order_items on public.order_items;
create trigger trg_guard_order_items
  before insert or update or delete on public.order_items
  for each row execute function public.fn_guard_order_items();

-- 7.3 Chốt giá vốn tại thời điểm thêm hàng vào đơn
create or replace function public.fn_snapshot_cost() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_item_costs (order_item_id, order_id, gia_von)
  values (
    new.id,
    new.order_id,
    coalesce((select gia_von from public.variant_costs where variant_id = new.variant_id), 0)
  )
  on conflict (order_item_id) do update set gia_von = excluded.gia_von;
  return new;
end $$;

drop trigger if exists trg_snapshot_cost on public.order_items;
create trigger trg_snapshot_cost
  after insert on public.order_items
  for each row execute function public.fn_snapshot_cost();

-- 7.4 Tự tạo / gắn khách hàng theo SĐT
create or replace function public.fn_link_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sdt text;
begin
  v_sdt := nullif(regexp_replace(coalesce(new.khach_sdt, ''), '[^0-9+]', '', 'g'), '');
  if v_sdt is null or new.customer_id is not null then return new; end if;

  select id into v_id from public.customers where sdt = v_sdt;
  if v_id is null then
    insert into public.customers (ho_ten, sdt, dia_chi)
    values (coalesce(nullif(new.khach_ten, ''), 'Khách ' || v_sdt), v_sdt, new.dia_chi)
    returning id into v_id;
  end if;

  new.khach_sdt := v_sdt;
  new.customer_id := v_id;
  return new;
end $$;

drop trigger if exists trg_link_customer on public.orders;
create trigger trg_link_customer
  before insert on public.orders
  for each row execute function public.fn_link_customer();

-- 7.5 Đồng bộ tồn kho theo trạng thái đơn
--     Trừ kho khi đơn vào trạng thái đã xác nhận / đang giao / hoàn thành.
--     Trả kho khi quay về mới / huỷ / hoàn.
create or replace function public.fn_order_stock_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_can_tru boolean;
  it record;
  v_thieu text;
begin
  -- Lúc INSERT chưa có dòng hàng nào → bỏ qua, để lần update trạng thái
  -- sau đó (sau khi đã thêm hàng) tự đồng bộ.
  if tg_op = 'INSERT' then
    new.da_tru_kho := false;
    return new;
  end if;

  -- Đơn import lịch sử: bỏ qua toàn bộ xử lý kho
  if new.bo_qua_kho then
    return new;
  end if;

  v_can_tru := new.trang_thai in ('da_xac_nhan','dang_giao','hoan_thanh');

  if v_can_tru and not new.da_tru_kho then
    -- chặn bán âm kho
    select string_agg(v.sku || ' (còn ' || coalesce(i.so_luong, 0) || ', cần ' || oi.so_luong || ')', ', ')
      into v_thieu
    from public.order_items oi
    join public.variants v on v.id = oi.variant_id
    left join public.inventory i on i.variant_id = oi.variant_id and i.store_id = new.store_id
    where oi.order_id = new.id and coalesce(i.so_luong, 0) < oi.so_luong;

    if v_thieu is not null then
      raise exception 'Không đủ tồn kho: %', v_thieu;
    end if;

    for it in
      select variant_id, so_luong from public.order_items
      where order_id = new.id and variant_id is not null
    loop
      perform public.fn_apply_move(it.variant_id, new.store_id, -it.so_luong,
                                   'ban', 'order', new.id, new.ma_don);
    end loop;
    new.da_tru_kho := true;

  elsif (not v_can_tru) and new.da_tru_kho then
    for it in
      select variant_id, so_luong from public.order_items
      where order_id = new.id and variant_id is not null
    loop
      perform public.fn_apply_move(it.variant_id, new.store_id, it.so_luong,
                                   'tra', 'order', new.id, 'Hoàn kho ' || new.ma_don);
    end loop;
    new.da_tru_kho := false;
  end if;

  return new;
end $$;

drop trigger if exists trg_order_stock_sync on public.orders;
create trigger trg_order_stock_sync
  before insert or update on public.orders
  for each row execute function public.fn_order_stock_sync();

-- 7.6 Phiếu nhập → cộng kho khi hoàn thành
create or replace function public.fn_receipt_stock_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if new.trang_thai = 'hoan_thanh' and coalesce(old.trang_thai, 'nhap') <> 'hoan_thanh' then
    for it in select variant_id, so_luong, gia_nhap from public.receipt_items where receipt_id = new.id
    loop
      perform public.fn_apply_move(it.variant_id, new.store_id, it.so_luong,
                                   'nhap', 'receipt', new.id, new.ma_phieu);
      -- cập nhật giá vốn mới nhất theo giá nhập
      insert into public.variant_costs (variant_id, gia_von, updated_at)
      values (it.variant_id, it.gia_nhap, now())
      on conflict (variant_id) do update set gia_von = excluded.gia_von, updated_at = now();
    end loop;

  elsif new.trang_thai = 'nhap' and old.trang_thai = 'hoan_thanh' then
    for it in select variant_id, so_luong from public.receipt_items where receipt_id = new.id
    loop
      perform public.fn_apply_move(it.variant_id, new.store_id, -it.so_luong,
                                   'huy', 'receipt', new.id, 'Huỷ ' || new.ma_phieu);
    end loop;
  end if;

  return new;
end $$;

drop trigger if exists trg_receipt_stock_sync on public.stock_receipts;
create trigger trg_receipt_stock_sync
  before update on public.stock_receipts
  for each row execute function public.fn_receipt_stock_sync();

-- 7.7 Phiếu chuyển kho: xuất khi gửi, nhập khi nhận
create or replace function public.fn_transfer_stock_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record; v_thieu text;
begin
  -- nhap -> dang_chuyen: trừ kho nguồn
  if new.trang_thai = 'dang_chuyen' and old.trang_thai = 'nhap' then
    select string_agg(v.sku || ' (còn ' || coalesce(i.so_luong, 0) || ')', ', ') into v_thieu
    from public.transfer_items ti
    join public.variants v on v.id = ti.variant_id
    left join public.inventory i on i.variant_id = ti.variant_id and i.store_id = new.from_store
    where ti.transfer_id = new.id and coalesce(i.so_luong, 0) < ti.so_luong;

    if v_thieu is not null then
      raise exception 'Kho nguồn không đủ hàng: %', v_thieu;
    end if;

    for it in select variant_id, so_luong from public.transfer_items where transfer_id = new.id loop
      perform public.fn_apply_move(it.variant_id, new.from_store, -it.so_luong,
                                   'chuyen_di', 'transfer', new.id, new.ma_phieu);
    end loop;

  -- dang_chuyen -> da_nhan: cộng kho đích
  elsif new.trang_thai = 'da_nhan' and old.trang_thai = 'dang_chuyen' then
    for it in select variant_id, so_luong from public.transfer_items where transfer_id = new.id loop
      perform public.fn_apply_move(it.variant_id, new.to_store, it.so_luong,
                                   'chuyen_den', 'transfer', new.id, new.ma_phieu);
    end loop;

  -- dang_chuyen -> huy: trả lại kho nguồn
  elsif new.trang_thai = 'huy' and old.trang_thai = 'dang_chuyen' then
    for it in select variant_id, so_luong from public.transfer_items where transfer_id = new.id loop
      perform public.fn_apply_move(it.variant_id, new.from_store, it.so_luong,
                                   'chuyen_den', 'transfer', new.id, 'Huỷ ' || new.ma_phieu);
    end loop;
  end if;

  return new;
end $$;

drop trigger if exists trg_transfer_stock_sync on public.transfers;
create trigger trg_transfer_stock_sync
  before update on public.transfers
  for each row execute function public.fn_transfer_stock_sync();

-- 7.8 Khoá dòng hàng của phiếu đã chốt
create or replace function public.fn_guard_doc_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_trang_thai text;
begin
  if tg_table_name = 'receipt_items' then
    select trang_thai into v_trang_thai from public.stock_receipts
    where id = coalesce(new.receipt_id, old.receipt_id);
    if v_trang_thai <> 'nhap' then
      raise exception 'Phiếu nhập đã hoàn thành — không sửa được dòng hàng';
    end if;
  else
    select trang_thai into v_trang_thai from public.transfers
    where id = coalesce(new.transfer_id, old.transfer_id);
    if v_trang_thai <> 'nhap' then
      raise exception 'Phiếu chuyển đã gửi — không sửa được dòng hàng';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_receipt_items on public.receipt_items;
create trigger trg_guard_receipt_items
  before insert or update or delete on public.receipt_items
  for each row execute function public.fn_guard_doc_items();

drop trigger if exists trg_guard_transfer_items on public.transfer_items;
create trigger trg_guard_transfer_items
  before insert or update or delete on public.transfer_items
  for each row execute function public.fn_guard_doc_items();

-- ============================================================
-- RPC: tạo đơn hàng nguyên khối (POS + chốt đơn inbox + import sàn)
-- security invoker → RLS vẫn áp dụng bình thường
-- ============================================================
create or replace function public.tao_don_hang(
  p_order jsonb,
  p_items jsonb,
  p_trang_thai text default 'moi'
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; it jsonb; v_variant uuid;
begin
  insert into public.orders (
    kenh, store_id, khach_ten, khach_sdt, dia_chi, thanh_toan,
    giam_gia, phi_ship, don_vi_van_chuyen, ma_van_don, ma_don_san, ngay_dat, ghi_chu,
    bo_qua_kho, created_by
  ) values (
    coalesce(p_order->>'kenh', 'store'),
    (p_order->>'store_id')::uuid,
    nullif(p_order->>'khach_ten', ''),
    nullif(p_order->>'khach_sdt', ''),
    nullif(p_order->>'dia_chi', ''),
    coalesce(p_order->>'thanh_toan', 'chua'),
    coalesce((p_order->>'giam_gia')::bigint, 0),
    coalesce((p_order->>'phi_ship')::bigint, 0),
    nullif(p_order->>'don_vi_van_chuyen', ''),
    nullif(p_order->>'ma_van_don', ''),
    nullif(p_order->>'ma_don_san', ''),
    coalesce((p_order->>'ngay_dat')::timestamptz, now()),
    nullif(p_order->>'ghi_chu', ''),
    coalesce((p_order->>'bo_qua_kho')::boolean, false),
    auth.uid()
  ) returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := nullif(it->>'variant_id', '')::uuid;
    insert into public.order_items (order_id, variant_id, sku, ten_hien_thi, so_luong, don_gia, giam_gia)
    values (
      v_id,
      v_variant,
      coalesce(nullif(it->>'sku', ''), (select sku from public.variants where id = v_variant)),
      coalesce(nullif(it->>'ten_hien_thi', ''), (select ten_bien_the from public.variants where id = v_variant)),
      coalesce((it->>'so_luong')::int, 1),
      coalesce((it->>'don_gia')::bigint, 0),
      coalesce((it->>'giam_gia')::bigint, 0)
    );
  end loop;

  if p_trang_thai <> 'moi' then
    update public.orders set trang_thai = p_trang_thai where id = v_id;
  end if;

  return v_id;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.stores           enable row level security;
alter table public.products         enable row level security;
alter table public.variants         enable row level security;
alter table public.variant_costs    enable row level security;
alter table public.inventory        enable row level security;
alter table public.stock_moves      enable row level security;
alter table public.customers        enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_item_costs enable row level security;
alter table public.stock_receipts   enable row level security;
alter table public.receipt_items    enable row level security;
alter table public.transfers        enable row level security;
alter table public.transfer_items   enable row level security;

-- Danh mục: ai đăng nhập cũng đọc, chỉ manager sửa
do $$
declare t text;
begin
  foreach t in array array['stores','products','variants'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all using (public.is_manager()) with check (public.is_manager())', t, t);
  end loop;
end $$;

-- GIÁ VỐN: chỉ manager (staff không thấy lãi lỗ)
drop policy if exists variant_costs_manager on public.variant_costs;
create policy variant_costs_manager on public.variant_costs
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists order_item_costs_manager on public.order_item_costs;
create policy order_item_costs_manager on public.order_item_costs
  for all using (public.is_manager()) with check (public.is_manager());

-- Tồn kho + sổ kho: đọc thoải mái, KHÔNG ai ghi tay (chỉ trigger definer)
drop policy if exists inventory_read on public.inventory;
create policy inventory_read on public.inventory
  for select using (auth.role() = 'authenticated');

drop policy if exists stock_moves_read on public.stock_moves;
create policy stock_moves_read on public.stock_moves
  for select using (auth.role() = 'authenticated');

-- Khách hàng: authenticated đọc/thêm/sửa, xoá manager
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select using (auth.role() = 'authenticated');
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert with check (auth.role() = 'authenticated');
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update using (auth.role() = 'authenticated');
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete using (public.is_manager());

-- Đơn hàng: authenticated đọc/tạo/sửa, xoá manager
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select using (auth.role() = 'authenticated');
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (auth.role() = 'authenticated');
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (auth.role() = 'authenticated');
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.is_manager());

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (auth.role() = 'authenticated');
drop policy if exists order_items_write on public.order_items;
create policy order_items_write on public.order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Nhập kho + chuyển kho: chỉ manager (chứa giá nhập)
do $$
declare t text;
begin
  foreach t in array array['stock_receipts','receipt_items','transfers','transfer_items'] loop
    execute format('drop policy if exists %I_manager on public.%I', t, t);
    execute format('create policy %I_manager on public.%I for all using (public.is_manager()) with check (public.is_manager())', t, t);
  end loop;
end $$;

-- ============================================================
-- Sau khi chạy:
--   1. Nâng account của Jen lên admin:
--      update public.profiles set role='admin'
--      where id = (select id from auth.users where email='jen.aescentic@gmail.com');
--   2. Gán nhân viên về cửa hàng:
--      update public.profiles set store_id=(select id from public.stores where ma='S1')
--      where id='<uuid nhân viên>';
--   3. Đổi tên 5 cửa hàng trong app: Cài đặt → Cửa hàng.
-- ============================================================
