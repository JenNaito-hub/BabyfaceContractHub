# ADR-0004 — Auth giữ Supabase, RBAC do OS tự quản

**Trạng thái:** Chấp nhận · 2026-08-15

## Quyết định

- **Xác thực (bạn là ai):** Supabase Auth. Đã chạy, có magic link + mật khẩu,
  quản lý session/refresh token, sẵn MFA khi cần. Không tự viết.
- **Phân quyền (bạn được làm gì):** OS tự quản bằng bảng trong Postgres.
  Không dùng `profiles.role` enum 3 mức nữa — không đủ cho 17 vai trò.

## Mô hình quyền

Chuỗi quyền: `resource.action.scope`

```
inventory.read.all        kho: đọc mọi địa điểm
inventory.adjust.store    kho: điều chỉnh, chỉ tại cửa hàng được gán
payroll.read.self         lương: chỉ xem của chính mình
payroll.approve.all       lương: duyệt toàn công ty
campaign.publish.all
b2b.quotation.approve.all
```

**scope** là phần quan trọng nhất, quyết định *phạm vi dữ liệu*:

| scope | Nghĩa |
| --- | --- |
| `self` | Chỉ bản ghi của chính người dùng |
| `store` | Các cửa hàng người dùng được gán (`user_store_assignments`) |
| `region` | Các cửa hàng thuộc vùng được gán |
| `department` | Phòng ban được gán |
| `all` | Toàn công ty |

Kiểm quyền trả về **cả quyết định lẫn bộ lọc dữ liệu**, không chỉ boolean:

```ts
const guard = await authorize(ctx, "inventory.read");
// guard.allowed === true
// guard.scope   === "store"
// guard.storeIds === ["uuid-1", "uuid-2"]   ← ép vào WHERE
```

Nhờ vậy không thể "được phép gọi API" nhưng lại đọc nhầm dữ liệu cửa hàng khác —
lỗi kinh điển của RBAC chỉ có boolean.

## Bảng

`roles · permissions · role_permissions · user_roles · user_store_assignments`

Vai trò và quyền là **dữ liệu, không phải code**. Thêm vai trò mới không cần deploy.
Seed tạo sẵn 17 vai trò trong master prompt, nhưng admin sửa được.

## Lớp phòng thủ thứ hai

Service layer là nơi enforce chính. Nhưng các bảng cực nhạy cảm vẫn bật RLS như
lưới an toàn nếu service có lỗ:

- `payroll`, `payroll_line` — chỉ chính chủ hoặc người có `payroll.read.all`
- `product_cost`, `order_line_cost` — giá vốn
- `employee_document` — hồ sơ nhân sự

Hai lớp là chủ ý: service layer bảo vệ đường đi bình thường, RLS bảo vệ khi có bug.

## Điều bắt buộc

Mọi route handler **phải** đi qua `withAuth(permission, handler)`. Có test kiểm
tra không route nào trong `apps/web/app/api/**` thiếu wrapper — quên thì CI đỏ,
không phải trông vào review.
