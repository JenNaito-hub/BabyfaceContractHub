# ADR-0003 — ORM: Drizzle, không dùng Prisma

**Trạng thái:** Chấp nhận · 2026-08-15

## Bối cảnh

Hệ thống sẽ có 60+ bảng, nhiều báo cáo tổng hợp nặng, và **đã dựa vào logic phía
database** (trigger toàn vẹn tồn kho, RLS cho dữ liệu nhạy cảm) — thứ đã được kiểm
thử và là tài sản đáng giữ.

## Quyết định

Dùng **Drizzle ORM** với migration SQL viết tay.

## Lý do

1. **Không tranh quyền sở hữu schema.** Prisma Migrate muốn schema là output của
   `schema.prisma`. Trigger, RLS policy, `SECURITY DEFINER` function, partial index
   đều nằm ngoài mô hình của nó và phải nhét vào migration thủ công — rồi `prisma
   db pull` lại không thấy chúng. Drizzle chấp nhận migration SQL là nguồn chuẩn,
   nên trigger tồn kho hiện có được giữ nguyên vẹn.
2. **Báo cáo cần SQL thật.** KPI, hoa hồng, lợi nhuận cửa hàng, cohort khách hàng
   đều là window function, CTE, aggregate nhiều tầng. Drizzle cho viết SQL có kiểu
   mà không phải rơi xuống `$queryRaw` mất kiểu.
3. **Runtime nhẹ.** Không engine binary, khởi động nhanh — quan trọng với route
   handler serverless trên Vercel.
4. **Hợp với Supabase.** Kết nối qua `postgres.js`, dùng được pgbouncer, và không
   xung đột với RLS.

## Đánh đổi chấp nhận

- DX kém Prisma Studio: bù bằng Drizzle Studio + `psql`.
- Migration viết tay tốn công hơn: **đây là chủ ý**. Với dữ liệu tài chính và kho,
  migration phải được đọc kỹ chứ không sinh tự động rồi apply mù.
- Quan hệ lồng nhiều tầng phải tự viết join: chấp nhận, đổi lại kiểm soát được
  truy vấn N+1.

## Quy ước

- Schema TypeScript ở `packages/database/src/schema/*.ts`, chia theo domain.
- Migration SQL ở `packages/database/migrations/NNNN_ten.sql`, chỉ tiến, không lùi.
- Mọi migration phải chạy được **hai lần liên tiếp không lỗi** (idempotent) —
  quy ước đã áp dụng cho schema hiện tại và giữ tiếp.
- Bảng tiền và kho luôn có: `created_at`, `created_by`, và ghi audit.
