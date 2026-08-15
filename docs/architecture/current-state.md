# Current state — trước khi bắt đầu AESCENTIC OS

Ngày khảo sát: 2026-08-15. Repo: `JenNaito-hub/BabyfaceContractHub`,
nhánh `claude/aescentic-sales-management-app-igv5m1`.

## Cái gì đang có

| Vùng | Dòng code | Trạng thái |
| --- | ---: | --- |
| Aescentic Sales (`/sales`) | ~7.900 | Chạy được, đã kiểm thử đầu-cuối |
| Babyface Talent (`/talent`) | ~1.500 | Chạy được, nghiệp vụ không liên quan |
| SQL schema + seed | ~1.300 | Đã kiểm trên Postgres thật |

Stack hiện tại: Next.js 15 (App Router) · Supabase (Auth + Postgres + RLS) ·
Tailwind · SheetJS · deploy dự kiến Vercel. **Chưa deploy.**

15 bảng: `profiles · stores · products · variants · variant_costs · inventory ·
stock_moves · customers · orders · order_items · order_item_costs ·
stock_receipts · receipt_items · transfers · transfer_items`.

## Những gì làm tốt và nên giữ

1. **Toàn vẹn tồn kho ở tầng database.** Mọi thay đổi tồn đi qua trigger
   `SECURITY DEFINER`, ghi sổ `stock_moves`, chặn bán âm kho. Không client nào
   ghi thẳng vào `inventory` được. Đây đúng là thứ AESCENTIC OS cần cho
   auditability, và là tài sản đáng giá nhất của bản hiện tại.
2. **Dữ liệu nhạy cảm tách bảng + RLS.** Giá vốn nằm ở `variant_costs` /
   `order_item_costs`, staff không đọc được kể cả gọi thẳng API. Mô hình này sẽ
   mở rộng thành RBAC `resource.action.scope`.
3. **Lớp import có ghép cột.** Đọc file sàn, tự đoán cột, chống import trùng.
   Tái dùng được cho mọi luồng nhập liệu về sau.
4. **Kiểm thử thật.** Có bộ e2e chạy trên Postgres + PostgREST thật
   (`scripts/demo/`), đã bắt được lỗi thật (bảng mã CSV).

## Mâu thuẫn trực diện cần xử lý

Master prompt nói: **"Nhanh.vn remains the primary POS / transaction source"** và
**"Do NOT rebuild functionality already handled well by existing external systems"**.

Bản hiện tại được xây theo yêu cầu ngược lại — *thay thế* Nhanh.vn/Haravan: nó có
POS riêng, tự trừ kho, tự sinh mã đơn, tự quản lý khách hàng.

Hai hướng không thể cùng đúng. Quyết định kiến trúc (xem ADR-0001):

> **Nhanh.vn là nguồn giao dịch chuẩn. AESCENTIC OS đồng bộ về, không ghi đè.**
> Phần POS/kho tự quản của bản hiện tại chuyển thành **fallback mode** — dùng cho
> kênh Nhanh.vn không phủ (B2B, bán sự kiện, kho tester/quà tặng) và cho giai
> đoạn chưa nối được API.

## Cái gì tái sử dụng được, cái gì bỏ

| Thành phần hiện tại | Số phận trong AESCENTIC OS |
| --- | --- |
| Trigger tồn kho + `stock_moves` | **Giữ**, mở rộng thành `InventoryTransaction` đa loại (tester, gift, damaged…) |
| Tách bảng dữ liệu nhạy cảm | **Giữ nguyên nguyên tắc**, thay RLS thủ công bằng RBAC có model |
| Lớp import ghép cột | **Giữ**, chuyển thành `packages/integrations/import` |
| Excel export | **Giữ** |
| POS `/sales/pos` | **Giữ ở chế độ fallback**, không còn là đường bán chính |
| Sinh `ma_don` phía OS | **Bỏ** cho đơn Nhanh — mã đơn do Nhanh cấp |
| `profiles.role` enum 3 mức | **Thay** bằng bảng `roles` + `permissions` cấu hình được |
| Bảng `talents/jobs/castings` | **Không đụng tới** — nghiệp vụ khác, để nguyên |

## Khoảng cách so với đích

Bản hiện tại phủ khoảng **1,5 / 19 module** (Retail một phần, Inventory một phần).
Chưa có: workforce, payroll, KPI, commission, procurement, production, QC, CRM/
loyalty, marketing, chat, AI, B2B, BNI, Zalo OA, Mini App, finance, tasks, SOP,
observability.

Quan trọng hơn số module: bản hiện tại **thiếu nền móng** cho quy mô đó — không có
RBAC cấu hình được, không có audit log, không có event bus, không có job queue,
không có versioned config, không có integration layer.

Phase 0 tồn tại để lấp đúng phần nền móng này.
