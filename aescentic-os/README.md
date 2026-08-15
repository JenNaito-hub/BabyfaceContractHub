# AESCENTIC OS

Lớp vận hành trung tâm của Aescentic. Xem `../docs/architecture/` cho kiến trúc
và quyết định thiết kế.

**Trạng thái: Phase 1 — bán được hàng thật.** POS, đơn hàng, kho, khách hàng,
nhập đơn từ sàn đều chạy và kiểm chứng được. Chi tiết chính xác cái gì xong và
cái gì chưa: `../docs/architecture/phase-1-status.md`.

## Chạy thử

```bash
npm install
export DATABASE_URL="postgres://postgres@127.0.0.1:5434/aescentic_os"

npm run db:migrate    # chạy 2 lần: lần 2 phải báo "không có migration mới"
npm run db:seed       # chạy 2 lần: không được nhân đôi dữ liệu
npx tsx packages/database/src/seed-sales.ts   # 160 đơn mẫu 45 ngày gần đây
npm test              # 83/83
npx tsc --noEmit

# Web
export AUTH_SECRET="chuoi-dai-hon-32-ky-tu"
export ALLOW_DEV_LOGIN=true
npm --workspace @aescentic/web run dev        # http://localhost:3100
node apps/web/e2e.mjs                         # 73/73 kiểm thử trình duyệt
```

Không có `DATABASE_URL` thì các test tích hợp bị bỏ qua kèm cảnh báo — chúng chạy
trên PostgreSQL thật, không mock database.

Đăng nhập nhanh theo tài khoản mẫu **chỉ chạy ở chế độ dev**. `NODE_ENV=production`
tắt cứng nó, kể cả khi có `ALLOW_DEV_LOGIN=true`.

## Cấu trúc

```
packages/
  database/      schema Drizzle · migration SQL · audit · seed
  permissions/   RBAC resource.action.scope, trả về cả bộ lọc dữ liệu
  auth/          dựng Principal từ vai trò + phạm vi được gán
  config/        cấu hình có effective_from/to
  events/        domain event theo mẫu outbox
  integrations/  POSProvider · NhanhProvider (khung) · MockPosProvider
  marketplace/   đọc file đơn Shopee/TikTok · tách địa chỉ (hàm thuần)
  shared/        tiện ích thuần
modules/
  sales/         đơn hàng, POS, nhập đơn từ sàn, số liệu doanh thu
  inventory/     tồn kho, sổ kho, kiểm kho
apps/
  web/           giao diện Next.js
  worker/        (chưa có) đọc outbox
```

Chiều phụ thuộc luôn là `apps → modules → packages`. `packages/*` không được
import `modules/*`; `modules/*` không được import `next/*` hay `react`. Có test
tự động kiểm, quên là CI đỏ.

### Nhãn dùng ở trình duyệt

`@aescentic/sales` kéo theo database, nên component client phải nhập nhãn từ
`@aescentic/sales/labels` (và `@aescentic/inventory/labels`). Nhập nhầm vào gốc
thì webpack nhét cả driver postgres vào bundle trình duyệt và build hỏng.

## Ai quản kho hàng bán

Theo ADR-0001, Nhanh.vn là nguồn sự thật cho đơn bán lẻ và tồn kho bán được.
Chưa có credential nên hiện OS tự quản để còn bán được hàng.

Luật này nằm ở **một chỗ duy nhất**: hàm `os.kho_ban_do_ai_quan()`. Khi Nhanh.vn
đồng bộ thành công lần đầu, trigger tự đổi chủ quản và database sẽ từ chối mọi
thao tác ghi tồn kho của OS vào kho hàng bán. Không cần sửa code.
