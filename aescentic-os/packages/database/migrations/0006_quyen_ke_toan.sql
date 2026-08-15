-- ============================================================
-- 0006 — Kế toán và tài chính phải xem được thứ họ được phép xem
--
-- Catalog ở 0002 cấp `product.cost.all` cho `accounting` và `finance` nhưng
-- không cấp `product.read` hay `inventory.read`. Quyền xem giá vốn là quyền
-- CHỒNG LÊN quyền xem sản phẩm, không phải quyền độc lập: không có quyền nền
-- thì màn hình sản phẩm và màn hình kho đều đóng, và giá vốn chẳng hiện ở đâu.
--
-- Kế toán cần cả hai để chốt giá vốn hàng bán và định giá tồn kho cuối kỳ;
-- tài chính cần để soát biên lợi nhuận. Đây là quyền ĐỌC, không kèm sửa.
-- ============================================================

insert into os.role_permissions (role_id, permission_id)
select r.id, p.id
from os.roles r
cross join os.permissions p
where r.code in ('accounting', 'finance')
  and (p.resource, p.action, p.scope) in (
    ('product', 'read', 'all'),
    ('inventory', 'read', 'all')
  )
on conflict do nothing;
