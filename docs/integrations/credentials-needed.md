# Credential cần cấp

Hệ thống chạy đầy đủ bằng mock provider khi chưa có. Mỗi dòng dưới đây chặn đúng
một phần chức năng, không chặn phần còn lại.

| # | Hệ thống | Biến môi trường | Lấy ở đâu | Chặn cái gì |
| --- | --- | --- | --- | --- |
| 1 | Nhanh.vn | `NHANH_APP_ID`, `NHANH_BUSINESS_ID`, `NHANH_ACCESS_TOKEN` | Nhanh.vn → Cấu hình → API / Ứng dụng | Đồng bộ đơn, tồn, sản phẩm, khách. Không có thì chạy fallback POS. |
| 2 | Supabase (production) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Toàn bộ hệ thống trên môi trường thật |
| 3 | Redis | `REDIS_URL` | Upstash hoặc tự host | Job nền: đồng bộ, lương, broadcast. Không có thì chạy đồng bộ tay. |
| 4 | Zalo OA | `ZALO_OA_ID`, `ZALO_OA_SECRET`, `ZALO_OA_ACCESS_TOKEN` | Zalo Official Account → Quản lý ứng dụng | Inbox khách hàng, broadcast, chăm sóc |
| 5 | Zalo Mini App | `ZALO_MINIAPP_ID`, `ZALO_MINIAPP_SECRET` | Zalo Mini App Console | Đăng nhập khách trên Mini App |
| 6 | Hoá đơn điện tử | tuỳ NCC | Cần **chọn nhà cung cấp trước** (Viettel, VNPT, MISA meInvoice…) | Phát hành HĐĐT |
| 7 | GHTK | `GHTK_TOKEN` | GHTK → Cài đặt → API | Đẩy vận đơn, đồng bộ trạng thái giao |
| 8 | AI | `ANTHROPIC_API_KEY` | console.anthropic.com | CEO AI, trợ lý nội bộ, concierge |

## Quyết định cần bạn đưa ra, không phải credential

1. **Nhà cung cấp hoá đơn điện tử** — chọn xong mới viết adapter được.
2. **Phần mềm kế toán đang dùng** — quyết định định dạng xuất.
3. **Kích hoạt hoa hồng B2B tại thời điểm nào** — mặc định đang là *đã thu tiền*
   (`COLLECTED`), cấu hình được sang *đã ký* hoặc *đã xuất hoá đơn*.

## Nguyên tắc bảo mật

- Không credential nào được commit vào repo.
- Không credential nào có tiền tố `NEXT_PUBLIC_` trừ Supabase URL và anon key.
- Token tích hợp chỉ đọc được từ tiến trình server và worker.
- Admin health hiển thị *đã cấu hình hay chưa*, **không bao giờ hiển thị giá trị**.
