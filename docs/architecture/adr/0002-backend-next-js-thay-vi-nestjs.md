# ADR-0002 — Backend: Next.js Route Handlers + modules thuần TS, không NestJS

**Trạng thái:** Chấp nhận · 2026-08-15

## Bối cảnh

Master prompt cho phép chọn NestJS hoặc Next.js API, và yêu cầu giải thích.

Điều kiện thực tế của Aescentic:
- Không có đội backend riêng. Bảo trì chủ yếu qua AI + một người kỹ thuật.
- Đã có Next.js đang chạy và deploy Vercel.
- Cần một tiến trình chạy job dài (đồng bộ, lương, AI) — Vercel không làm được.

## Quyết định

**Domain logic sống trong `modules/*` — TypeScript thuần, không phụ thuộc framework.**
Next.js Route Handlers và worker chỉ là hai lớp vỏ gọi vào cùng module đó.

```
modules/inventory/
  service.ts      ← logic, không import next/nest, nhận deps qua tham số
  repository.ts   ← truy vấn Drizzle
  events.ts
  schema.ts       ← Zod, dùng chung cho API và form
  service.test.ts
```

Route handler mỏng:

```ts
export const POST = withAuth("inventory.adjust.store", async (ctx, req) => {
  const input = adjustSchema.parse(await req.json());
  return Response.json(await inventory.adjust(ctx, input));
});
```

## Vì sao không NestJS

1. **Không giải quyết vấn đề thật của dự án này.** NestJS mạnh ở DI, module
   boundary, decorator. Ranh giới module ở đây đã đạt được bằng cấu trúc thư mục
   + quy tắc import (enforce bằng ESLint `no-restricted-imports`).
2. **Thêm một deploy target.** NestJS cần host riêng ngay từ đầu; Next.js đã có
   Vercel. Ta vẫn cần một worker, nhưng worker là tiến trình Node đơn giản chạy
   BullMQ — không cần cả framework HTTP.
3. **Chi phí bảo trì.** Với đội một người, mỗi lớp trừu tượng thừa là nợ.
4. **Không khoá cửa.** Vì logic không import framework, muốn bọc NestJS sau này
   chỉ là viết controller mới gọi đúng service cũ. Chi phí chuyển đổi thấp và có
   thể làm từng module.

## Điều kiện để đổi ý

Chuyển sang service riêng (NestJS hoặc khác) khi có **ít nhất một** trong các dấu hiệu đo được:

- một module cần scale/deploy độc lập (ví dụ AI concierge của Mini App tiêu tài nguyên rất khác),
- thời gian build web vượt ~10 phút,
- có đội backend tách biệt cần vòng đời release riêng.

Không tách vì "cảm thấy nên tách".

## Enforce ranh giới

- `modules/*` **cấm** import `next/*`, `react`, hoặc `apps/*`.
- Module A gọi module B chỉ qua public API (`modules/b/index.ts`), không import sâu.
- Giao tiếp lỏng ưu tiên domain event thay vì gọi chéo trực tiếp.
- Có ESLint rule chặn, chạy trong CI.
