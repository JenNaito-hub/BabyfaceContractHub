-- ============================================================
-- 0005 — Tồn kho không được âm, chặn ở tầng thấp nhất
--
-- 0003 chỉ kiểm tra đủ hàng trên đường bán (trigger đơn hàng). Mọi đường khác
-- — kiểm kho, chuyển kho, đồng bộ, hay một câu SQL gọi thẳng — vẫn đẩy được số
-- dư xuống âm. Kho âm là con số nói dối: nhân viên nhìn thấy "còn -3" thì
-- không biết phải tin cái gì, và mọi báo cáo giá vốn tính từ đó đều sai.
--
-- Chặn ngay trong `fn_apply_stock_move` để không đường nào lách được. Thông
-- báo thiếu hàng thân thiện của trigger đơn hàng vẫn chạy trước, nên trải
-- nghiệm bán hàng không đổi.
-- ============================================================

create or replace function os.fn_apply_stock_move(
  p_sku uuid, p_location uuid, p_delta integer, p_kind text,
  p_ref_type text, p_ref_id text, p_note text
) returns void language plpgsql security definer set search_path = os, public as $$
declare
  v_managed_by text;
  v_con integer;
  v_ma text;
  v_ten_kho text;
begin
  if p_delta = 0 then return; end if;

  select managed_by, name into v_managed_by, v_ten_kho
  from os.inventory_locations where id = p_location;
  if v_managed_by is null then
    raise exception 'Không tìm thấy địa điểm kho %', p_location;
  end if;

  -- 'sync' là biến động do chính lớp đồng bộ Nhanh.vn ghi lại, được phép
  if v_managed_by = 'nhanh' and p_kind <> 'sync' then
    raise exception
      'Địa điểm này do Nhanh.vn quản lý — AESCENTIC OS không được ghi tồn kho ở đây. '
      'Sửa bên Nhanh.vn rồi đồng bộ về.';
  end if;

  -- Tạo dòng số dư nếu chưa có. Phải tách khỏi bước cộng delta: nếu nhét thẳng
  -- delta vào câu INSERT thì PostgreSQL kiểm CHECK trên chính dòng đó TRƯỚC khi
  -- xử lý ON CONFLICT, nên bán 3 cái từ kho 200 cũng báo vi phạm.
  insert into os.inventory_balances (sku_id, location_id, quantity)
  values (p_sku, p_location, 0)
  on conflict (sku_id, location_id) do nothing;

  -- Khoá dòng trước khi tính: hai người bán cùng lúc không được đọc cùng một
  -- con số rồi cùng cho là đủ hàng.
  select quantity into v_con
  from os.inventory_balances
  where sku_id = p_sku and location_id = p_location
  for update;

  if v_con + p_delta < 0 then
    select code into v_ma from os.skus where id = p_sku;
    raise exception
      'Tồn kho không được âm: % tại % còn %, thao tác này trừ %',
      coalesce(v_ma, p_sku::text), coalesce(v_ten_kho, p_location::text), v_con, abs(p_delta);
  end if;

  update os.inventory_balances
  set quantity = v_con + p_delta, updated_at = now()
  where sku_id = p_sku and location_id = p_location;

  insert into os.inventory_transactions
    (sku_id, location_id, delta, kind, ref_type, ref_id, note, created_by)
  values (p_sku, p_location, p_delta, p_kind, p_ref_type, p_ref_id, p_note, os.actor_id());
end $$;

-- ============================================================
-- Dọn số dư âm còn sót lại (nếu có) trước khi dựng ràng buộc.
-- Mỗi lần sửa đều ghi một dòng sổ kho và một dòng nhật ký: không sửa lén.
-- ============================================================
do $$
declare r record;
begin
  for r in select sku_id, location_id, quantity
           from os.inventory_balances where quantity < 0 loop
    insert into os.inventory_transactions
      (sku_id, location_id, delta, kind, ref_type, note)
    values (r.sku_id, r.location_id, -r.quantity, 'stock_count', 'migration',
            'Migration 0005: đưa số dư âm về 0');

    update os.inventory_balances set quantity = 0, updated_at = now()
    where sku_id = r.sku_id and location_id = r.location_id;

    insert into os.audit_log (actor_user_id, actor_label, event, entity_type, entity_id,
                              previous_value, new_value, reason)
    values (null, 'migration 0005', 'inventory.adjusted', 'sku', r.sku_id::text,
            jsonb_build_object('quantity', r.quantity),
            jsonb_build_object('quantity', 0),
            'Số dư âm phát sinh trước khi có ràng buộc — đưa về 0');
  end loop;
end $$;

-- Lưới an toàn cuối cùng: kể cả UPDATE thẳng vào bảng cũng không âm được.
alter table os.inventory_balances
  drop constraint if exists inventory_balances_khong_am;
alter table os.inventory_balances
  add constraint inventory_balances_khong_am check (quantity >= 0);
