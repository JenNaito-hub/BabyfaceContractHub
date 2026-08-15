# CHANGELOG — AESCENTIC OS

## [0.1.0] — 2026-08-15 — Phase 0 (nền móng)

### Kiến trúc
- Khảo sát hiện trạng, chốt hướng đi và ghi thành ADR 0001–0004.
- Quyết định: Nhanh.vn là nguồn giao dịch, OS không ghi đè (ADR-0001).
- Quyết định: Next.js + modules TypeScript thuần, không NestJS (ADR-0002).
- Quyết định: Drizzle + migration SQL viết tay, không Prisma (ADR-0003).
- Quyết định: giữ Supabase Auth, RBAC tự quản trong OS (ADR-0004).

### Đã thêm
- Monorepo `aescentic-os/` với workspace và tsconfig dùng chung.
- `packages/database` — schema Drizzle, migration runner, audit helper, seed.
- `packages/permissions` — RBAC `resource.action.scope`; `authorize()` trả về cả
  quyết định lẫn bộ lọc dữ liệu.
- `packages/auth` — dựng Principal từ vai trò và phạm vi được gán.
- `packages/config` — cấu hình có `effective_from/to`, đọc theo thời điểm.
- `packages/events` — domain event theo mẫu outbox.
- `packages/integrations` — `POSProvider`, `NhanhProvider` (khung), `MockPosProvider`.
- `packages/shared` — tiện ích dùng chung.
- Migration `0001_foundation` — 22 bảng: identity, org, catalog, inventory location, platform.
- Migration `0002_rbac_catalog` — 93 quyền, 18 vai trò hệ thống, bảng gán quyền.
- Seed Phase 0 — 7 địa điểm, 20 nhân sự, 30 sản phẩm, 60 SKU, 13 kho.

### Kiểm thử
- 36 test xanh, chạy trên Postgres thật (không mock database).
- Migration và seed chạy lại nhiều lần không đổi kết quả.
- Test phân quyền viết theo hướng "cửa hàng A không thấy dữ liệu cửa hàng B",
  không phải "gọi API có 200 không".

### Chưa làm trong Phase 0
- `apps/web` — vỏ Next.js, đăng nhập, màn hình admin.
- `apps/worker` — tiến trình chạy BullMQ.
- Xem `docs/architecture/phase-0-status.md` để biết chính xác còn gì.
