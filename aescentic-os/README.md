# AESCENTIC OS

Lớp vận hành trung tâm của Aescentic. Xem `../docs/architecture/` cho kiến trúc
và quyết định thiết kế.

**Trạng thái: Phase 0 chưa xong.** Tầng dữ liệu và phân quyền đã chạy và kiểm
được; vỏ web (`apps/web`) chưa có. Chi tiết chính xác:
`../docs/architecture/phase-0-status.md`.

## Chạy thử

```bash
npm install
export DATABASE_URL="postgres://postgres@127.0.0.1:5434/aescentic_os"

npm run db:migrate    # chạy 2 lần: lần 2 phải báo "không có migration mới"
npm run db:seed       # chạy 2 lần: không được nhân đôi dữ liệu
npm test              # 36/36
npx tsc --noEmit
```

Không có `DATABASE_URL` thì 22 test tích hợp bị bỏ qua kèm cảnh báo — chúng chạy
trên PostgreSQL thật, không mock database.

## Cấu trúc

```
packages/
  database/      schema Drizzle · migration SQL · audit · seed
  permissions/   RBAC resource.action.scope, trả về cả bộ lọc dữ liệu
  auth/          dựng Principal từ vai trò + phạm vi được gán
  config/        cấu hình có effective_from/to
  events/        domain event theo mẫu outbox
  integrations/  POSProvider · NhanhProvider (khung) · MockPosProvider
  shared/        tiện ích thuần
apps/            (chưa có) web · worker · miniapp
modules/         (chưa có) domain logic, bắt đầu từ Phase 1
```

Chiều phụ thuộc luôn là `apps → modules → packages`. `packages/*` không được
import `modules/*`; `modules/*` không được import `next/*` hay `react`.
