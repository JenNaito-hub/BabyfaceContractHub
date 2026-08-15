# Babyface Talent Manager

Web app nhiều nhân viên quản lý **talent** và **casting** cho Babyface. Next.js (App Router) + Supabase Auth/DB, deploy trên Vercel.

Xây theo `TALENT_MANAGER_BUILD_SPEC.md`. Khu vực chính nằm ở route group **`/talent`**.

## Tính năng

- **Login** — Supabase Auth (email + mật khẩu hoặc magic link). Mỗi nhân viên 1 account.
- **Dashboard tháng** — chọn tháng → chỉ số (lượt casting, talent unique, talent ≥2 job, đậu, tổng HĐ/OT/thanh toán), bảng theo job, biểu đồ cột (thanh toán/job) + tròn (casting/job), nút **Xuất Excel** (SheetJS, client-side).
- **Jobs** — list job theo tháng; thêm/sửa/xoá; vào 1 job để quản lý casting (thêm talent, chỉnh vai/kết quả/tiền/OT inline).
- **Talent directory** — tìm kiếm, thêm/sửa; hiện số job đã làm + tổng tiền nhận; **SĐT ẩn mặc định, chỉ manager bấm hiện**; bộ lọc `status` (pending/approved) + nút duyệt cho manager.
- **Duyệt talent** — hàng chờ `pending` cho manager duyệt/từ chối.

### v2 — những thứ phần mềm bán lẻ (nhanh.vn, KiotViet, Sapo…) không có

- **Lịch shooting + chống trùng lịch** (`/talent/lich`) — lịch tháng dạng grid, mỗi job hiện ở đúng
  ngày diễn ra (job nhiều ngày trải từ `ngay_bat_dau` → `ngay_ket_thuc`). Tự cảnh báo khi **1 talent
  bị đặt 2+ job cùng ngày**. Cảnh báo cũng hiện ngay trong trang job. Chỉ xét casting **Đậu** — casting
  chưa chốt kết quả thì chưa chiếm lịch.
- **Thanh toán cát-xê + thuế TNCN** (`/talent/thanh-toan`) — công nợ phải trả talent: lọc theo
  tháng/trạng thái, sửa thuế từng dòng, nút **điền thuế 10% gợi ý** hàng loạt (chỉ áp cho khoản chi
  trả ≥ 2.000.000đ theo TT 111/2013), đánh dấu **đã trả** đơn lẻ hoặc hàng loạt, xuất Excel 2 sheet.
  Chỉ manager mới bỏ được đánh dấu đã trả.
- **Đánh giá talent sau job + blacklist** — chấm 1–5 ★ kèm đề xuất (*Nên dùng lại / Cân nhắc / Không
  dùng lại*) cho từng casting đậu; directory hiện điểm trung bình. Manager blacklist được talent kèm
  lý do; app cảnh báo khi thêm talent blacklist vào job.
- **Tìm talent theo hình thể** — lọc nâng cao ở directory: giới tính, phân loại, khoảng chiều cao/cân
  nặng, điểm đánh giá tối thiểu, đã/chưa từng casting, ẩn blacklist. Chiều cao/cân nặng nhập tự do
  (`170`, `1m70`, `55kg`) đều đọc được.
- **Nhật ký thay đổi** (`/talent/audit`, manager-only) — trigger ở tầng database ghi lại ai sửa gì,
  lúc nào trên `talents`/`jobs`/`castings`/`talent_contacts`. Vì ghi ở DB nên không né được kể cả khi
  gọi thẳng API. Với `talent_contacts` chỉ ghi *tên cột đã đổi*, **không ghi giá trị SĐT/email**.

## Nguyên tắc bảo mật (thực thi bằng RLS ở Supabase)

- **SĐT tách bảng riêng** `talent_contacts` — chỉ `admin`/`manager` đọc/ghi. Bảng `talents` KHÔNG chứa SĐT.
- **Talent mới = `pending`**, phải manager duyệt tay mới thành `approved`.
- Bật RLS trên **mọi** bảng. Chi tiết ở `supabase_schema.sql`.

> Lưu ý: RLS là lớp bảo vệ thật. UI chỉ ẩn nút cho đẹp — kể cả khi staff gọi thẳng API, policy ở DB vẫn chặn đọc SĐT và đổi `status`.

## Data model

`profiles` (role) · `talents` (không SĐT, có `status`, `is_blacklisted`) · `talent_contacts` (SĐT — RLS chặt) · `jobs` (theo tháng `YYYY-MM`, `ngay_bat_dau`/`ngay_ket_thuc` cho lịch) · `castings` (nối talent ↔ job: vai, kết quả, tiền, OT, trạng thái thanh toán, thuế khấu trừ) · `talent_ratings` (đánh giá sau job) · `audit_logs` (nhật ký, chỉ manager đọc).

Công thức tính (giữ y bản artifact cũ):
- **talent unique** = số `talent_id` phân biệt trong tháng.
- **talent trùng** = talent có ≥2 job phân biệt trong tháng.
- **Tổng thanh toán** = Σ(`so_tien_hd` + `chi_phi_ot`) của casting `Đậu`.
- **Thực nhận** = (`so_tien_hd` + `chi_phi_ot`) − `khau_tru_thue`.
- **Thuế TNCN gợi ý** = 10% khi tổng chi trả 1 lần ≥ 2.000.000đ, ngược lại 0 (sửa tay được từng dòng).

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

## Nâng cấp DB cho v2

Chạy lại **toàn bộ** `supabase_schema.sql` trong SQL Editor — file idempotent, chạy nhiều lần không lỗi,
tự thêm cột/bảng/trigger mới mà không đụng dữ liệu cũ. Sau khi chạy:

- Job cũ có `ngay_shooting` dạng ISO (`2026-08-20`) được backfill sang `ngay_bat_dau` tự động. Job ghi
  kiểu tự do (`12-14/07`) phải mở từng job nhập lại ngày thì mới lên lịch được — trang **Lịch** liệt kê
  sẵn danh sách job còn thiếu ngày.
- Casting cũ mặc định `trang_thai_tt = 'Chưa trả'`, `khau_tru_thue = 0`.

## Ngoài phạm vi đợt này

Đọc comcard bằng AI · import Excel bản cũ · upload ảnh portfolio · xuất hợp đồng PDF/e-sign · phân
quyền theo từng job. Giá client & margin **không** đưa vào hệ thống này (giữ file riêng).
