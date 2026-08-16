-- ============================================================
-- 0007 — Đối soát COD
--
-- Hãng vận chuyển (GHTK, GHN, Viettel Post…) thu tiền hộ rồi vài ngày sau mới
-- chuyển khoản về, kèm một file kê khai. Việc đối soát là so từng mã vận đơn
-- trong file với đơn hàng trong hệ thống: khớp thì đánh dấu đã nhận tiền, lệch
-- thì phải biết lệch bao nhiêu và của đơn nào.
--
-- Không đối soát thì tiền hãng giữ hộ không ai biết còn thiếu bao nhiêu — đây
-- là chỗ mất tiền âm thầm lớn nhất của bán hàng online.
-- ============================================================

alter table os.orders
  add column if not exists cod_reconciled_at timestamptz,
  add column if not exists cod_amount bigint;

comment on column os.orders.cod_reconciled_at is
  'Thời điểm đối soát tiền COD với hãng vận chuyển. NULL = chưa nhận được tiền.';
comment on column os.orders.cod_amount is
  'Số tiền hãng vận chuyển THỰC TRẢ. Có thể khác total nếu hãng trừ phí hoặc thu thiếu.';

create index if not exists orders_cod_chua_doi_soat_idx
  on os.orders (carrier, placed_at)
  where payment_status = 'cod' and cod_reconciled_at is null;

-- ============================================================
-- Mỗi lần đối soát là một đợt, giữ lại để tra ngược
-- ============================================================
create table if not exists os.cod_batches (
  id uuid primary key default gen_random_uuid(),
  carrier text not null,
  file_name text,
  -- Tổng hãng báo trả trong file
  total_reported bigint not null default 0,
  -- Tổng của những đơn thực sự khớp và được ghi nhận
  total_matched bigint not null default 0,
  matched_count integer not null default 0,
  diff_count integer not null default 0,
  missing_count integer not null default 0,
  note text,
  created_by uuid references os.users(id),
  created_at timestamptz not null default now()
);

create table if not exists os.cod_batch_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references os.cod_batches(id) on delete cascade,
  tracking_code text not null,
  -- Tiền hãng khai trong file
  amount_reported bigint not null default 0,
  -- Tổng đơn trong hệ thống tại thời điểm đối soát
  amount_expected bigint,
  order_id uuid references os.orders(id),
  -- khop | lech | khong_thay | da_doi_soat
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists cod_batch_lines_batch_idx on os.cod_batch_lines (batch_id);

alter table os.cod_batches enable row level security;
alter table os.cod_batch_lines enable row level security;
drop policy if exists cod_batches_no_anon on os.cod_batches;
drop policy if exists cod_batch_lines_no_anon on os.cod_batch_lines;
create policy cod_batches_no_anon on os.cod_batches for all using (false) with check (false);
create policy cod_batch_lines_no_anon on os.cod_batch_lines for all using (false) with check (false);

-- ============================================================
-- Quyền đối soát: là việc của kế toán và tài chính, không phải của bán hàng.
-- Cấp bằng dữ liệu như mọi quyền khác, sửa được mà không cần deploy.
-- ============================================================
insert into os.permissions (resource, action, scope, description)
values
  ('cod', 'read', 'all', 'Xem tình trạng đối soát COD'),
  ('cod', 'reconcile', 'all', 'Chốt đối soát COD với hãng vận chuyển')
on conflict (resource, action, scope) do nothing;

insert into os.role_permissions (role_id, permission_id)
select r.id, p.id
from os.roles r
cross join os.permissions p
where p.resource = 'cod'
  and (
    (r.code in ('accounting', 'finance') and p.action in ('read', 'reconcile'))
    or (r.code in ('bod', 'ops_manager') and p.action = 'read')
  )
on conflict do nothing;
