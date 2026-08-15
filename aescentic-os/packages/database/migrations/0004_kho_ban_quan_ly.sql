-- ============================================================
-- 0004 — Ai quản kho hàng bán: Nhanh.vn hay AESCENTIC OS?
--
-- ADR-0001: Nhanh.vn là nguồn sự thật cho đơn bán lẻ và tồn kho bán được.
-- Nhưng chừng nào chưa có credential Nhanh.vn thì OS phải tự bán được, nếu
-- không thì Jen không dùng được gì cả.
--
-- 0003 có một câu UPDATE làm việc này, nhưng nó chạy TRƯỚC khi seed tạo địa
-- điểm nên trên database mới toanh nó không chạm vào dòng nào. Sửa bằng cách
-- đưa luật thành một hàm: migration, seed và test đều hỏi cùng một chỗ.
-- ============================================================

create or replace function os.kho_ban_do_ai_quan() returns text
language sql stable set search_path = os, public as $$
  select case
    when exists (
      select 1 from os.integration_sync_state
      where provider = 'nhanh' and last_success_at is not null
    ) then 'nhanh'
    else 'os'
  end
$$;

comment on function os.kho_ban_do_ai_quan() is
  'Trả về ''nhanh'' khi Nhanh.vn đã đồng bộ thành công ít nhất một lần, ngược lại ''os''. '
  'Địa điểm kind=''sellable'' phải mang giá trị này. Xem ADR-0001.';

-- Mặc định cho địa điểm hàng bán tạo mới (seed cũng dựa vào đây).
alter table os.inventory_locations
  alter column managed_by set default 'os';

-- Đưa các dòng hiện có về đúng luật.
update os.inventory_locations
set managed_by = os.kho_ban_do_ai_quan()
where kind = 'sellable' and managed_by <> os.kho_ban_do_ai_quan();

-- ============================================================
-- Khi Nhanh.vn đồng bộ thành công lần đầu, kho bán phải tự chuyển sang
-- 'nhanh' — không chờ ai nhớ chạy tay. Trigger ở 0003 sẽ lập tức chặn OS ghi.
-- ============================================================
create or replace function os.fn_dong_bo_doi_chu_kho() returns trigger
language plpgsql security definer set search_path = os, public as $$
begin
  if new.provider = 'nhanh'
     and new.last_success_at is not null
     and (old.last_success_at is null) then
    update os.inventory_locations
    set managed_by = 'nhanh'
    where kind = 'sellable' and managed_by <> 'nhanh';

    insert into os.audit_log (actor_user_id, actor_label, event, entity_type, entity_id,
                              previous_value, new_value, reason)
    values (null, 'hệ thống', 'inventory.ownership_changed', 'integration', 'nhanh',
            jsonb_build_object('managed_by', 'os'),
            jsonb_build_object('managed_by', 'nhanh'),
            'Nhanh.vn đồng bộ thành công lần đầu — kho hàng bán chuyển về Nhanh.vn quản');
  end if;
  return new;
end $$;

drop trigger if exists trg_dong_bo_doi_chu_kho on os.integration_sync_state;
create trigger trg_dong_bo_doi_chu_kho
  after update on os.integration_sync_state
  for each row execute function os.fn_dong_bo_doi_chu_kho();
