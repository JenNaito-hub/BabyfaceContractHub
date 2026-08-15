# Phase 0 — trạng thái thật

> **Đã cũ.** Tài liệu này chốt trạng thái Phase 0. Trạng thái hiện tại xem
> `phase-1-status.md` — app bán hàng đã được gộp vào AESCENTIC OS.

Cập nhật 2026-08-15. Tài liệu này nói chính xác cái gì chạy được và cái gì chưa,
không làm tròn lên.

## Đã xong và đã kiểm chứng

| Hạng mục | Bằng chứng |
| --- | --- |
| Monorepo + tsconfig + workspace | `npx tsc --noEmit` sạch |
| Migration runner, chỉ tiến, có checksum | chạy 2 lần liên tiếp: lần 2 không đổi gì |
| 22 bảng nền móng | migration `0001_foundation` chạy trên Postgres 16 |
| 93 quyền + 18 vai trò | migration `0002_rbac_catalog`, là dữ liệu nên sửa được |
| RBAC có scope + bộ lọc dữ liệu | 14 unit test + 7 test tích hợp với dữ liệu thật |
| Dựng Principal từ DB | test: gỡ vai trò → mất quyền ngay lần dựng sau |
| Cấu hình theo thời điểm | test: kỳ lương tháng 3 dùng tỷ lệ tháng 3, không phải tỷ lệ mới nhất |
| Audit log + chỉ ghi trường đổi | test ghi/đọc lại |
| Domain event outbox | test phát → lấy ra → đánh dấu đã xử lý |
| `POSProvider` + MockPosProvider | test phân trang: đủ 60 SKU, không trùng, không thiếu |
| Khung `NhanhProvider` | **chưa chạy với credential thật** |
| Seed Phase 0 | 7 địa điểm, 20 nhân sự, 30 SP, 60 SKU, 13 kho; chạy lại không nhân đôi |
| `apps/web` khởi động và build | 7 route, build sạch |
| Đăng nhập chạy thật | e2e: chưa đăng nhập → đẩy về /login, API trả 401 |
| Phân quyền áp đúng ở UI | e2e với 4 vai trò: nhân viên chỉ thấy 1 cửa hàng, CEO thấy 7 |
| `withAuth()` cho mọi route API | test tự quét thư mục, thiếu wrapper là CI đỏ |
| Kỷ luật kiến trúc | test: `packages/*` không import `next`/`react`/`modules` |

**40/40 test xanh** (unit + tích hợp trên PostgreSQL thật) và **21/21 kiểm thử
đầu-cuối trên trình duyệt**, lặp lại nhiều lần cho cùng kết quả.

## Phase 0 đã đạt Definition of Done

DoD yêu cầu: hệ thống khởi động · migration chạy · đăng nhập được · phân quyền
chặn đúng · audit ghi đúng · test xanh. **Cả sáu đều đạt và kiểm chứng được.**

### Đăng nhập ở môi trường phát triển

Chưa có Supabase project nên `apps/web` dùng `DevSessionProvider`: cookie ký HMAC,
chọn tài khoản để chạy thử. Nó **bị khoá hai lớp** — chỉ bật khi
`NODE_ENV !== "production"` **và** `ALLOW_DEV_LOGIN=true`, và app sẽ ném lỗi lúc
khởi động nếu ai đó đặt biến này trên production. Khi có Supabase, thêm
`SupabaseSessionProvider` là đủ; phần còn lại không đổi vì `loadPrincipal()` chỉ
nhận `userId`.

## Còn lại, không thuộc Phase 0

| Hạng mục | Vì sao chưa | Ước lượng |
| --- | --- | --- |
| `apps/worker` — BullMQ đọc outbox | Cần `REDIS_URL`; outbox đã chạy được không cần Redis | ~0,5 lượt |
| ESLint chặn import xuyên tầng | Đã enforce bằng test trong `routes.test.ts`; ESLint là thêm lớp nữa | ~0,2 lượt |
| `SupabaseSessionProvider` | Cần credential Supabase | ~0,3 lượt |

## Quan hệ với app Aescentic Sales đang có

App bán hàng ở thư mục gốc **không bị đụng tới** và vẫn chạy như cũ. AESCENTIC OS
nằm gọn trong `aescentic-os/`, dùng schema `os` riêng trong cùng database.

Lý do tách như vậy: app bán hàng là thứ gần với giá trị sử dụng nhất hiện nay
(đã kiểm thử đầu-cuối, sẵn sàng deploy). Không có lý do gì phá nó để dựng nền cho
một hệ thống còn ở Phase 0. Khi OS đủ chín, app bán hàng sẽ được gộp vào thành
`apps/sales` — đường đi đã ghi trong `current-state.md`.

## Cách kiểm chứng lại

```bash
cd aescentic-os
export DATABASE_URL="postgres://postgres@127.0.0.1:5434/aescentic_os"
npm install
npm run db:migrate && npm run db:migrate   # lần 2 phải báo "không có migration mới"
npm run db:seed && npm run db:seed         # lần 2 không được nhân đôi dữ liệu
npm test                                   # 40/40
npx tsc --noEmit                           # không lỗi

# Vỏ web + đăng nhập
export AUTH_SECRET="chuoi-dai-hon-32-ky-tu"
export ALLOW_DEV_LOGIN=true
npm --workspace @aescentic/web run dev      # http://localhost:3100
node apps/web/e2e.mjs                       # 21/21 kiểm thử trình duyệt
```
