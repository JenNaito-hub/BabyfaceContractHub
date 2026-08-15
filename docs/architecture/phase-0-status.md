# Phase 0 — trạng thái thật

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

**36/36 test xanh**, chạy trên PostgreSQL thật, lặp lại 3 lần cho cùng kết quả.

## Chưa làm — phần còn lại của Phase 0

| Hạng mục | Vì sao chưa | Ước lượng |
| --- | --- | --- |
| `apps/web` — vỏ Next.js, đăng nhập, màn hình quản trị vai trò/cửa hàng | Hết ngân sách lượt này | ~1 lượt làm việc |
| `withAuth()` wrapper cho route handler + test "không route nào thiếu wrapper" | Phụ thuộc `apps/web` | cùng lượt trên |
| `apps/worker` — BullMQ đọc outbox | Cần `REDIS_URL`; outbox đã chạy được không cần Redis | ~0,5 lượt |
| ESLint chặn `modules/*` import `next/*` | Quy tắc đã ghi trong ADR-0002, chưa enforce bằng CI | ~0,2 lượt |

Nói thẳng: **Phase 0 chưa đạt Definition of Done.** DoD yêu cầu "hệ thống khởi
động, đăng nhập được". Tầng dữ liệu và tầng quyền đã xong và kiểm được; tầng vỏ
web thì chưa. Không tính là xong cho tới khi đăng nhập chạy thật.

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
npm test                                   # 36/36
npx tsc --noEmit                           # không lỗi
```
