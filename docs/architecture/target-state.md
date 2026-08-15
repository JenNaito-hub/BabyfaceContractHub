# Target state — AESCENTIC OS

## Nguyên tắc

1. **Một nguồn dữ liệu.** Nhập một lần, dùng ở mọi module.
2. **Không xây lại thứ hệ thống ngoài đang làm tốt.** Nhanh.vn giữ vai trò POS và
   nguồn giao dịch. Hoá đơn điện tử dùng nhà cung cấp có chứng nhận. Kế toán xuất
   sang phần mềm kế toán. OS là lớp *intelligence + workflow*, không phải lớp thay thế.
3. **Modular monolith trước.** Tách service chỉ khi có lý do đo được.
4. **Mọi con số phải truy ngược được.** Hoa hồng → đơn hàng. Lương → chấm công +
   KPI + hoa hồng. Tồn → giao dịch kho. Không có số nào "từ trên trời rơi xuống".
5. **Cấu hình chứ không hard-code.** Mọi ngưỡng KPI, tỷ lệ hoa hồng, quy tắc lương
   đều có `effective_from` / `effective_to` và lịch sử phiên bản.

## Kiến trúc tổng thể

```
                    ┌───────────────────────────────────────┐
   Nhanh.vn ──sync─▶│                                       │
   Zalo OA  ──────▶ │        apps/web   (Next.js)           │◀── nhân viên, quản lý
   E-Invoice ◀────▶ │        apps/miniapp (Zalo Mini App)   │◀── khách hàng
   Kế toán  ◀──────│                                       │
                    └───────────────┬───────────────────────┘
                                    │ gọi trực tiếp (in-process)
                    ┌───────────────▼───────────────────────┐
                    │   modules/*   — domain logic           │
                    │   retail · inventory · workforce ·     │
                    │   compensation · crm · b2b · ...       │
                    └───────────────┬───────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
    packages/database        packages/events       packages/permissions
       (Drizzle)              (domain events)         (RBAC)
              │                     │
              ▼                     ▼
        PostgreSQL            Redis + BullMQ ──▶ apps/worker
        (Supabase)                                (sync, payroll, AI, broadcast)
```

`apps/worker` là tiến trình riêng vì Vercel không chạy được job dài. Nó import
đúng các `modules/*` mà web dùng — cùng domain logic, khác nơi chạy.

## Ranh giới hệ thống — cái gì OS làm, cái gì không

| Việc | Ai làm | Vì sao |
| --- | --- | --- |
| Bán tại quầy, in bill, chốt ca tiền mặt | **Nhanh.vn** | Đã làm tốt, nhân viên đã quen, có phần cứng |
| Phát hành hoá đơn điện tử | **Nhà cung cấp HĐĐT** | Yêu cầu pháp lý + chứng nhận, không tự làm |
| Sổ sách kế toán, thuế | **Phần mềm kế toán** | OS xuất dữ liệu sang, không thay thế |
| Chat với khách | **Zalo OA** | OS gắn panel khách hàng cạnh hội thoại |
| Phân tích, KPI, hoa hồng, lương | **OS** | Không hệ thống nào có đủ dữ liệu chéo |
| Điều phối ca, nghỉ phép, chấm công | **OS** | |
| CRM 360, Scent ID, loyalty | **OS** | |
| B2B pipeline, hợp đồng, máy khuếch tán, BNI | **OS** | Nhanh.vn không có khái niệm này |
| Kho tester / quà tặng / hàng hỏng | **OS** | Nhanh.vn chỉ quản kho bán |
| Mua hàng, sản xuất, batch, QC | **OS** | |

## Stack

| Lớp | Chọn | Lý do ngắn (chi tiết ở ADR) |
| --- | --- | --- |
| Frontend | Next.js 15 + TypeScript + Tailwind + shadcn/ui | Đã có sẵn, deploy Vercel, App Router phù hợp dashboard nặng server |
| State/data | TanStack Query + React Hook Form + Zod | Zod dùng chung cho cả validate API |
| Backend | **Next.js Route Handlers + `modules/*` thuần TS** (không NestJS) | ADR-0002 |
| ORM | **Drizzle** | ADR-0003 |
| DB | PostgreSQL (Supabase) | Đã có, kèm Auth + Storage |
| Auth | **Supabase Auth** giữ nguyên, RBAC tự quản ở OS | ADR-0004 |
| Queue | Redis + BullMQ (`apps/worker`) | Job dài, retry, cron |
| Storage | Supabase Storage (S3-compatible) | Hợp đồng, ảnh SP, chứng từ QC, hồ sơ HR |
| Search | Postgres FTS → pgvector cho RAG | Không thêm Elasticsearch khi chưa cần |
| AI | `AIProvider` interface, mặc định Anthropic | Không khoá cứng một nhà cung cấp |

## Bảo mật

- RBAC `resource.action.scope`, lưu trong DB, gán theo vai trò, cấu hình được.
- Kiểm quyền ở **tầng service**, không ở component. UI chỉ ẩn cho gọn.
- RLS Postgres giữ làm **lớp phòng thủ thứ hai** cho các bảng nhạy cảm
  (lương, giá vốn, hồ sơ nhân sự) — phòng khi service layer có lỗ.
- Audit log bắt buộc cho: tiền, kho, lương, quyền, hợp đồng.
- Secrets chỉ ở server. Mini App và web client không bao giờ thấy token tích hợp.

## Định nghĩa "xong" (nhắc lại, dùng cho mọi PR)

Database · permissions · API · UI · validation · audit · tests · trạng thái
loading/error/empty · dùng được trên điện thoại · docs · không có dữ liệu giả ·
không có TODO trên đường đi chính.
