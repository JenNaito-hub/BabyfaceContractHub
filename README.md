# Aescentic Sales · Babyface Talent

Hai app dùng chung 1 codebase, 1 database Supabase và 1 tài khoản đăng nhập.
Next.js (App Router) + Supabase Auth/DB, deploy trên Vercel.

| App | Route | Schema | Tài liệu |
| --- | --- | --- | --- |
| **Aescentic Sales** — bán hàng đa kênh (Shopee, TikTok, Facebook, Website, 5 cửa hàng) | `/sales` | `supabase_sales_schema.sql` | [AESCENTIC_SALES.md](AESCENTIC_SALES.md) |
| **Babyface Talent** — talent & casting | `/talent` | `supabase_schema.sql` | phần dưới |

Đăng nhập xong vào `/` để chọn app.

---

# Babyface Talent Manager

Web app nhiều nhân viên quản lý **talent** và **casting** cho Babyface.

Xây theo `TALENT_MANAGER_BUILD_SPEC.md`. Khu vực chính nằm ở route group **`/talent`**.

## Tính năng

- **Login** — Supabase Auth (email + mật khẩu hoặc magic link). Mỗi nhân viên 1 account.
- **Dashboard tháng** — chọn tháng → chỉ số (lượt casting, talent unique, talent ≥2 job, đậu, tổng HĐ/OT/thanh toán), bảng theo job, biểu đồ cột (thanh toán/job) + tròn (casting/job), nút **Xuất Excel** (SheetJS, client-side).
- **Jobs** — list job theo tháng; thêm/sửa/xoá; vào 1 job để quản lý casting (thêm talent, chỉnh vai/kết quả/tiền/OT inline).
- **Talent directory** — tìm kiếm, thêm/sửa; hiện số job đã làm + tổng tiền nhận; **SĐT ẩn mặc định, chỉ manager bấm hiện**; bộ lọc `status` (pending/approved) + nút duyệt cho manager.
- **Duyệt talent** — hàng chờ `pending` cho manager duyệt/từ chối.

## Nguyên tắc bảo mật (thực thi bằng RLS ở Supabase)

- **SĐT tách bảng riêng** `talent_contacts` — chỉ `admin`/`manager` đọc/ghi. Bảng `talents` KHÔNG chứa SĐT.
- **Talent mới = `pending`**, phải manager duyệt tay mới thành `approved`.
- Bật RLS trên **mọi** bảng. Chi tiết ở `supabase_schema.sql`.

> Lưu ý: RLS là lớp bảo vệ thật. UI chỉ ẩn nút cho đẹp — kể cả khi staff gọi thẳng API, policy ở DB vẫn chặn đọc SĐT và đổi `status`.

## Data model

`profiles` (role) · `talents` (không SĐT, có `status`) · `talent_contacts` (SĐT — RLS chặt) · `jobs` (theo tháng `YYYY-MM`) · `castings` (nối talent ↔ job: vai, kết quả, tiền, OT).

Công thức tính (giữ y bản artifact cũ):
- **talent unique** = số `talent_id` phân biệt trong tháng.
- **talent trùng** = talent có ≥2 job phân biệt trong tháng.
- **Tổng thanh toán** = Σ(`so_tien_hd` + `chi_phi_ot`) của casting `Đậu`.

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền URL + anon key thật (Supabase → Settings → API)
npm run dev                  # http://localhost:3000
```

Biến môi trường:

| Biến | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Chỉ nếu cần server route đặc quyền — KHÔNG prefix `NEXT_PUBLIC_` |

## Thiết lập Supabase (1 lần)

1. Mở **SQL Editor** trong project Supabase → dán toàn bộ `supabase_schema.sql` → Run. Verify RLS đã bật đủ ở tab Authentication → Policies.
2. Tạo account nhân viên trong **Authentication → Users** (trigger tự tạo `profiles` role `staff`).
3. Nâng account của Jen lên admin:
   ```sql
   update public.profiles set role = 'admin' where id = '<uuid của Jen>';
   ```
4. Gán `manager` cho ai cần duyệt talent + xem SĐT:
   ```sql
   update public.profiles set role = 'manager' where id = '<uuid>';
   ```

## Deploy Vercel

1. Connect repo `JenNaito-hub/BabyfaceContractHub`.
2. Framework preset: **Next.js** (mặc định).
3. Thêm env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Trong Supabase → Authentication → URL Configuration, thêm domain Vercel vào **Redirect URLs** (cho magic link callback `/auth/callback`).
5. Deploy.

## Kiểm thử phân quyền (bắt buộc trước khi giao)

Tạo 2 account khác role và verify:
- **staff**: KHÔNG thấy SĐT, KHÔNG thấy tab Duyệt, KHÔNG đổi được `status`.
- **manager**: thấy + hiện SĐT, duyệt được talent.

## Ngoài phạm vi đợt này

Đọc comcard bằng AI · import Excel bản cũ · phân quyền theo từng job / audit log. Giá client & margin **không** đưa vào hệ thống này (giữ file riêng).
