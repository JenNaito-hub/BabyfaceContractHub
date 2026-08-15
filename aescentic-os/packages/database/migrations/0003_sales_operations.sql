-- ============================================================
-- AESCENTIC OS — Phase 1: nghiệp vụ bán hàng và kho
--
-- Đưa toàn bộ vận hành bán hàng vào schema `os` để cả hệ thống chỉ còn MỘT
-- nguồn dữ liệu. Logic toàn vẹn tồn kho port từ app bán hàng đã kiểm thử,
-- bổ sung thêm chốt chặn `managed_by` theo ADR-0001.
--
-- Idempotent. Chỉ tiến, không lùi.
-- ============================================================

/**
 * Ai đang thao tác, do lớp service đặt bằng `set local os.actor_id`.
 * Không phụ thuộc schema `auth` của Supabase để migration chạy được ở mọi nơi.
 */
create or replace function os.actor_id() returns uuid
language sql stable as $$
  select nullif(current_setting('os.actor_id', true), '')::uuid
$$;

-- ---------- 1. Khách hàng ----------
create table if not exists os.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text unique,
  email text,
  address text,
  province text,
  district text,
  ward text,
  tier text not null default 'le' check (tier in ('le','si','vip')),
  note text,
  source text not null default 'os',
  external_ref text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_phone_idx on os.customers(phone);
create unique index if not exists customers_source_ref_idx
  on os.customers(source, external_ref) where external_ref is not null;

-- ---------- 2. Tồn kho ----------
create table if not exists os.inventory_balances (
  sku_id uuid not null references os.skus(id) on delete cascade,
  location_id uuid not null references os.inventory_locations(id) on delete cascade,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (sku_id, location_id)
);

create table if not exists os.inventory_transactions (
  id bigserial primary key,
  sku_id uuid not null references os.skus(id) on delete cascade,
  location_id uuid not null references os.inventory_locations(id) on delete cascade,
  delta integer not null,
  kind text not null check (kind in (
    'receipt','sale','sale_return','transfer_out','transfer_in',
    'stock_count','damage','tester','gift','sync'
  )),
  ref_type text,
  ref_id text,
  note text,
  created_by uuid references os.users(id),
  created_at timestamptz not null default now()
);
create index if not exists inv_tx_sku_idx on os.inventory_transactions(sku_id, created_at desc);
create index if not exists inv_tx_ref_idx on os.inventory_transactions(ref_type, ref_id);
create index if not exists inv_tx_loc_idx on os.inventory_transactions(location_id, created_at desc);

-- ---------- 3. Đơn hàng ----------
create sequence if not exists os.order_code_seq;

create table if not exists os.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'AE' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
            || '-' || lpad(nextval('os.order_code_seq')::text, 4, '0'),
  channel text not null default 'store'
    check (channel in ('store','shopee','tiktok','facebook','website','b2b','event')),
  store_id uuid not null references os.stores(id),
  location_id uuid not null references os.inventory_locations(id),
  customer_id uuid references os.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  address text,
  province text,
  district text,
  status text not null default 'new'
    check (status in ('new','confirmed','shipping','completed','cancelled','returned')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','cod','paid')),
  subtotal bigint not null default 0,
  discount bigint not null default 0,
  shipping_fee bigint not null default 0,
  total bigint not null default 0,
  carrier text,
  tracking_code text,
  external_ref text,
  placed_at timestamptz not null default now(),
  note text,
  stock_applied boolean not null default false,
  -- Đơn lịch sử đồng bộ từ Nhanh.vn: tính doanh thu nhưng không đụng tồn kho
  skip_stock boolean not null default false,
  sold_by uuid references os.users(id),
  created_by uuid references os.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_placed_idx on os.orders(placed_at desc);
create index if not exists orders_store_idx on os.orders(store_id);
create index if not exists orders_status_idx on os.orders(status);
create index if not exists orders_soldby_idx on os.orders(sold_by);
create unique index if not exists orders_channel_ref_idx
  on os.orders(channel, external_ref) where external_ref is not null;

create table if not exists os.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references os.orders(id) on delete cascade,
  sku_id uuid references os.skus(id) on delete set null,
  sku_code text,
  display_name text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price bigint not null default 0,
  discount bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists order_lines_order_idx on os.order_lines(order_id);

-- GIÁ VỐN chốt tại thời điểm bán — bảng riêng, RLS chặn
create table if not exists os.order_line_costs (
  order_line_id uuid primary key references os.order_lines(id) on delete cascade,
  order_id uuid not null references os.orders(id) on delete cascade,
  unit_cost bigint not null default 0
);
create index if not exists order_line_costs_order_idx on os.order_line_costs(order_id);

-- ---------- 4. Phiếu nhập kho ----------
create sequence if not exists os.receipt_code_seq;

create table if not exists os.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'PN' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
            || '-' || lpad(nextval('os.receipt_code_seq')::text, 4, '0'),
  location_id uuid not null references os.inventory_locations(id),
  supplier_name text,
  status text not null default 'draft' check (status in ('draft','completed')),
  received_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  note text,
  created_by uuid references os.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists os.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references os.stock_receipts(id) on delete cascade,
  sku_id uuid not null references os.skus(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  unit_cost bigint not null default 0
);
create index if not exists receipt_lines_receipt_idx on os.receipt_lines(receipt_id);

-- ---------- 5. Phiếu chuyển kho ----------
create sequence if not exists os.transfer_code_seq;

create table if not exists os.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'CK' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
            || '-' || lpad(nextval('os.transfer_code_seq')::text, 4, '0'),
  from_location_id uuid not null references os.inventory_locations(id),
  to_location_id uuid not null references os.inventory_locations(id),
  status text not null default 'draft'
    check (status in ('draft','in_transit','received','cancelled')),
  moved_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  note text,
  created_by uuid references os.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_khac_dia_diem check (from_location_id <> to_location_id)
);

create table if not exists os.transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references os.stock_transfers(id) on delete cascade,
  sku_id uuid not null references os.skus(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0)
);
create index if not exists transfer_lines_transfer_idx on os.transfer_lines(transfer_id);

-- ============================================================
-- HÀM LÕI: mọi thay đổi tồn kho đi qua đây
-- ============================================================

/**
 * Ghi một biến động kho. SECURITY DEFINER để bỏ qua RLS của bảng tồn —
 * không client nào ghi thẳng vào inventory_balances được.
 *
 * Chốt chặn ADR-0001: địa điểm do Nhanh.vn quản thì OS KHÔNG được ghi.
 * Vi phạm là ném lỗi ở database, không phải chờ code review bắt.
 */
create or replace function os.fn_apply_stock_move(
  p_sku uuid, p_location uuid, p_delta integer, p_kind text,
  p_ref_type text, p_ref_id text, p_note text
) returns void language plpgsql security definer set search_path = os, public as $$
declare v_managed_by text;
begin
  if p_delta = 0 then return; end if;

  select managed_by into v_managed_by from os.inventory_locations where id = p_location;
  if v_managed_by is null then
    raise exception 'Không tìm thấy địa điểm kho %', p_location;
  end if;

  -- 'sync' là biến động do chính lớp đồng bộ Nhanh.vn ghi lại, được phép
  if v_managed_by = 'nhanh' and p_kind <> 'sync' then
    raise exception
      'Địa điểm này do Nhanh.vn quản lý — AESCENTIC OS không được ghi tồn kho ở đây. '
      'Sửa bên Nhanh.vn rồi đồng bộ về.';
  end if;

  insert into os.inventory_balances (sku_id, location_id, quantity)
  values (p_sku, p_location, p_delta)
  on conflict (sku_id, location_id)
  do update set quantity = os.inventory_balances.quantity + excluded.quantity,
                updated_at = now();

  insert into os.inventory_transactions
    (sku_id, location_id, delta, kind, ref_type, ref_id, note, created_by)
  values (p_sku, p_location, p_delta, p_kind, p_ref_type, p_ref_id, p_note, os.actor_id());
end $$;

/** Kiểm kho: đưa tồn về đúng số đếm thực tế. */
create or replace function os.dieu_chinh_ton(
  p_sku uuid, p_location uuid, p_thuc_te integer, p_ly_do text
) returns integer language plpgsql security definer set search_path = os, public as $$
declare v_hien_tai integer; v_delta integer;
begin
  select coalesce(quantity, 0) into v_hien_tai
  from os.inventory_balances where sku_id = p_sku and location_id = p_location;
  v_delta := p_thuc_te - coalesce(v_hien_tai, 0);

  perform os.fn_apply_stock_move(
    p_sku, p_location, v_delta, 'stock_count', 'stock_count', null,
    coalesce(p_ly_do, 'Kiểm kho'));
  return v_delta;
end $$;

-- ============================================================
-- TRIGGER
-- ============================================================

-- Tính lại tổng đơn khi dòng hàng đổi
create or replace function os.fn_recalc_order() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare v_order uuid; v_subtotal bigint;
begin
  v_order := coalesce(new.order_id, old.order_id);
  select coalesce(sum(quantity * unit_price - discount), 0) into v_subtotal
  from os.order_lines where order_id = v_order;

  update os.orders
  set subtotal = v_subtotal,
      total = v_subtotal - discount + shipping_fee,
      updated_at = now()
  where id = v_order;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_order on os.order_lines;
create trigger trg_recalc_order
  after insert or update or delete on os.order_lines
  for each row execute function os.fn_recalc_order();

-- Khoá dòng hàng khi đơn đã trừ kho
create or replace function os.fn_guard_order_lines() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare v_applied boolean;
begin
  select stock_applied into v_applied
  from os.orders where id = coalesce(new.order_id, old.order_id);

  if coalesce(v_applied, false) then
    raise exception 'Đơn đã trừ kho — đưa đơn về trạng thái "Mới" trước khi sửa hàng';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_order_lines on os.order_lines;
create trigger trg_guard_order_lines
  before insert or update or delete on os.order_lines
  for each row execute function os.fn_guard_order_lines();

-- Chốt giá vốn tại thời điểm thêm hàng
create or replace function os.fn_snapshot_line_cost() returns trigger
language plpgsql security definer set search_path = os, public as $$
begin
  insert into os.order_line_costs (order_line_id, order_id, unit_cost)
  values (
    new.id, new.order_id,
    coalesce((select unit_cost from os.product_costs where sku_id = new.sku_id), 0)
  )
  on conflict (order_line_id) do update set unit_cost = excluded.unit_cost;
  return new;
end $$;

drop trigger if exists trg_snapshot_line_cost on os.order_lines;
create trigger trg_snapshot_line_cost
  after insert on os.order_lines
  for each row execute function os.fn_snapshot_line_cost();

-- Tự tạo / gắn khách hàng theo SĐT
create or replace function os.fn_link_customer() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare v_id uuid; v_phone text;
begin
  v_phone := nullif(regexp_replace(coalesce(new.customer_phone, ''), '[^0-9+]', '', 'g'), '');
  if v_phone is null or new.customer_id is not null then return new; end if;

  select id into v_id from os.customers where phone = v_phone;
  if v_id is null then
    insert into os.customers (full_name, phone, address, province, district)
    values (coalesce(nullif(new.customer_name, ''), 'Khách ' || v_phone),
            v_phone, new.address, new.province, new.district)
    returning id into v_id;
  end if;

  new.customer_phone := v_phone;
  new.customer_id := v_id;
  return new;
end $$;

drop trigger if exists trg_link_customer on os.orders;
create trigger trg_link_customer
  before insert on os.orders
  for each row execute function os.fn_link_customer();

-- Đồng bộ tồn kho theo trạng thái đơn
create or replace function os.fn_order_stock_sync() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare v_can_apply boolean; it record; v_thieu text;
begin
  -- Lúc INSERT chưa có dòng hàng; để lần update trạng thái sau tự xử lý
  if tg_op = 'INSERT' then
    new.stock_applied := false;
    return new;
  end if;

  if new.skip_stock then return new; end if;

  v_can_apply := new.status in ('confirmed','shipping','completed');

  if v_can_apply and not new.stock_applied then
    select string_agg(
             s.code || ' (còn ' || coalesce(b.quantity, 0) || ', cần ' || l.quantity || ')', ', ')
      into v_thieu
    from os.order_lines l
    join os.skus s on s.id = l.sku_id
    left join os.inventory_balances b
      on b.sku_id = l.sku_id and b.location_id = new.location_id
    where l.order_id = new.id and coalesce(b.quantity, 0) < l.quantity;

    if v_thieu is not null then
      raise exception 'Không đủ tồn kho: %', v_thieu;
    end if;

    for it in select sku_id, quantity from os.order_lines
              where order_id = new.id and sku_id is not null loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.location_id, -it.quantity, 'sale', 'order', new.id::text, new.code);
    end loop;
    new.stock_applied := true;

  elsif (not v_can_apply) and new.stock_applied then
    for it in select sku_id, quantity from os.order_lines
              where order_id = new.id and sku_id is not null loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.location_id, it.quantity, 'sale_return', 'order', new.id::text,
        'Hoàn kho ' || new.code);
    end loop;
    new.stock_applied := false;
  end if;

  return new;
end $$;

drop trigger if exists trg_order_stock_sync on os.orders;
create trigger trg_order_stock_sync
  before insert or update on os.orders
  for each row execute function os.fn_order_stock_sync();

-- Phiếu nhập: cộng kho và cập nhật giá vốn khi hoàn thành
create or replace function os.fn_receipt_sync() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare it record;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    for it in select sku_id, quantity, unit_cost from os.receipt_lines where receipt_id = new.id loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.location_id, it.quantity, 'receipt', 'receipt', new.id::text, new.code);

      insert into os.product_costs (sku_id, unit_cost, effective_from, updated_at)
      values (it.sku_id, it.unit_cost, now(), now())
      on conflict (sku_id) do update
        set unit_cost = excluded.unit_cost, effective_from = now(), updated_at = now();
    end loop;

  elsif new.status = 'draft' and old.status = 'completed' then
    for it in select sku_id, quantity from os.receipt_lines where receipt_id = new.id loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.location_id, -it.quantity, 'receipt', 'receipt', new.id::text,
        'Huỷ ' || new.code);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_receipt_sync on os.stock_receipts;
create trigger trg_receipt_sync
  before update on os.stock_receipts
  for each row execute function os.fn_receipt_sync();

-- Phiếu chuyển: xuất khi gửi, nhập khi nhận
create or replace function os.fn_transfer_sync() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare it record; v_thieu text;
begin
  if new.status = 'in_transit' and old.status = 'draft' then
    select string_agg(s.code || ' (còn ' || coalesce(b.quantity, 0) || ')', ', ') into v_thieu
    from os.transfer_lines l
    join os.skus s on s.id = l.sku_id
    left join os.inventory_balances b
      on b.sku_id = l.sku_id and b.location_id = new.from_location_id
    where l.transfer_id = new.id and coalesce(b.quantity, 0) < l.quantity;

    if v_thieu is not null then
      raise exception 'Kho gửi không đủ hàng: %', v_thieu;
    end if;

    for it in select sku_id, quantity from os.transfer_lines where transfer_id = new.id loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.from_location_id, -it.quantity, 'transfer_out', 'transfer',
        new.id::text, new.code);
    end loop;

  elsif new.status = 'received' and old.status = 'in_transit' then
    for it in select sku_id, quantity from os.transfer_lines where transfer_id = new.id loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.to_location_id, it.quantity, 'transfer_in', 'transfer',
        new.id::text, new.code);
    end loop;

  elsif new.status = 'cancelled' and old.status = 'in_transit' then
    for it in select sku_id, quantity from os.transfer_lines where transfer_id = new.id loop
      perform os.fn_apply_stock_move(
        it.sku_id, new.from_location_id, it.quantity, 'transfer_in', 'transfer',
        new.id::text, 'Huỷ ' || new.code);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_transfer_sync on os.stock_transfers;
create trigger trg_transfer_sync
  before update on os.stock_transfers
  for each row execute function os.fn_transfer_sync();

-- Khoá dòng hàng của chứng từ đã chốt
create or replace function os.fn_guard_doc_lines() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare v_status text;
begin
  if tg_table_name = 'receipt_lines' then
    select status into v_status from os.stock_receipts
    where id = coalesce(new.receipt_id, old.receipt_id);
    if v_status <> 'draft' then
      raise exception 'Phiếu nhập đã hoàn thành — không sửa được dòng hàng';
    end if;
  else
    select status into v_status from os.stock_transfers
    where id = coalesce(new.transfer_id, old.transfer_id);
    if v_status <> 'draft' then
      raise exception 'Phiếu chuyển đã gửi đi — không sửa được dòng hàng';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_receipt_lines on os.receipt_lines;
create trigger trg_guard_receipt_lines
  before insert or update or delete on os.receipt_lines
  for each row execute function os.fn_guard_doc_lines();

drop trigger if exists trg_guard_transfer_lines on os.transfer_lines;
create trigger trg_guard_transfer_lines
  before insert or update or delete on os.transfer_lines
  for each row execute function os.fn_guard_doc_lines();

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['customers','orders','stock_receipts','stock_transfers'] loop
    execute format('drop trigger if exists trg_touch_%1$s on os.%1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on os.%1$I
       for each row execute function os.fn_touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- RLS cho bảng giá vốn mới
-- ============================================================
alter table os.order_line_costs enable row level security;
drop policy if exists order_line_costs_no_anon on os.order_line_costs;
create policy order_line_costs_no_anon on os.order_line_costs
  for all using (false) with check (false);

-- ============================================================
-- Cho tới khi nối được Nhanh.vn, OS tự quản kho bán hàng.
-- Khi có credential, đổi managed_by sang 'nhanh' và trigger ở trên sẽ
-- tự động chặn OS ghi tiếp — không cần sửa code.
-- ============================================================
update os.inventory_locations
set managed_by = 'os'
where kind = 'sellable' and managed_by = 'nhanh'
  and not exists (select 1 from os.integration_sync_state
                  where provider = 'nhanh' and last_success_at is not null);
