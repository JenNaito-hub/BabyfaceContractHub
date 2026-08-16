-- ============================================================
-- 0009 — Chốt dòng hàng theo đúng thứ ảnh hưởng tới kho và tiền
--
-- 0003 chặn MỌI thao tác sửa `order_lines` khi đơn đã trừ kho. Mục đích đúng:
-- đổi số lượng hay đổi SKU sau khi đã trừ kho thì tồn kho lệch ngay, và đổi
-- đơn giá thì doanh thu không khớp với tiền đã thu.
--
-- Nhưng nó chặn cả những cột chỉ để người đọc: `display_name`. Sửa một cái tên
-- hiển thị in sai trên phiếu giao hàng cũng bị từ chối, buộc phải đưa đơn về
-- trạng thái "Mới" — tức là hoàn kho rồi trừ lại, chỉ để sửa một chữ.
--
-- Chốt lại theo đúng cột thật sự nguy hiểm.
-- ============================================================

create or replace function os.fn_guard_order_lines() returns trigger
language plpgsql security definer set search_path = os, public as $$
declare v_applied boolean;
begin
  select stock_applied into v_applied
  from os.orders where id = coalesce(new.order_id, old.order_id);

  if not coalesce(v_applied, false) then
    return coalesce(new, old);
  end if;

  -- Thêm hoặc xoá dòng hàng thì kho lệch ngay, luôn cấm.
  if tg_op in ('INSERT', 'DELETE') then
    raise exception 'Đơn đã trừ kho — đưa đơn về trạng thái "Mới" trước khi thêm/bớt hàng';
  end if;

  -- Sửa: chỉ cấm những cột động tới kho hoặc tiền.
  if new.sku_id is distinct from old.sku_id
     or new.quantity is distinct from old.quantity then
    raise exception 'Đơn đã trừ kho — đưa đơn về trạng thái "Mới" trước khi đổi hàng hoặc số lượng';
  end if;

  if new.unit_price is distinct from old.unit_price
     or new.discount is distinct from old.discount then
    raise exception 'Đơn đã chốt — không đổi được giá. Huỷ đơn rồi tạo lại nếu bán sai giá.';
  end if;

  -- Còn lại (display_name, sku_code) chỉ là chữ hiển thị, cho sửa.
  return new;
end $$;
