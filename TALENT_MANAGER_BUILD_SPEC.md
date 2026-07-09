# TALENT MANAGER — BUILD SPEC (multi-user, Supabase + Next.js)

Mục tiêu: nâng cấp app quản lý talent/casting từ bản artifact 1 người (lưu local) lên **web app nhiều nhân viên dùng chung**, có login, database thật trên Supabase, deploy 1 link.

Giao cho **Claude Code** thực thi trực tiếp trên máy Jen. Ưu tiên build **chồng lên** codebase sẵn có `D:\Jen\Babyface Prompt Studio\babyface-prompt-studio-v1` (Next.js + Supabase đã cấu hình), thêm một khu vực `/talent` thay vì tạo project mới.

---

## 1. Stack & hạ tầng
- **Frontend:** Next.js (App Router) + React, style theo brand token: Lime `#D7F205`, Dark `#1A1A1A`, Paper `#EFEEEA`, Warning `#E8553A`; font Plus Jakarta Sans (display) + Be Vietnam Pro (body).
- **Backend:** Supabase project `nmgqpirrvzzysgxybccd` (Tokyo). Dùng `@supabase/supabase-js` + `@supabase/ssr`.
- **Auth:** Supabase Auth (email + password, hoặc magic link). Mỗi nhân viên 1 account.
- **Deploy:** Vercel (đã có cho Prompt Studio). Env cần: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, và service role key chỉ dùng ở server route nếu cần.
- **Xuất Excel:** giữ SheetJS như bản cũ (client-side).

## 2. Nguyên tắc bảo mật (BẮT BUỘC — không thương lượng)
- **SĐT tách bảng riêng** `talent_contacts`, có RLS. Chỉ role `admin` / `manager` đọc được. Bảng `talents` KHÔNG chứa SĐT.
- **Talent mới phải duyệt tay:** cột `status` = `pending` khi nhập, chỉ `approved` mới vào directory chính thức. Nhân viên thường tạo `pending`; manager duyệt sang `approved`.
- **Tiền hợp đồng trả talent** (`so_tien_hd`, `chi_phi_ot`) là data vận hành → để trong `castings`. Nhưng **giá client / margin KHÔNG đưa vào hệ thống này** — vẫn giữ ở file riêng như hiện tại.
- Bật RLS trên MỌI bảng. Không có policy = không ai đọc được.

## 3. Data model (chi tiết ở file supabase_schema.sql)
- `profiles` — hồ sơ user + role (`admin` | `manager` | `staff`), map tới `auth.users`.
- `talents` — hồ sơ talent (KHÔNG có SĐT), có `status`.
- `talent_contacts` — SĐT + liên hệ nhạy cảm, RLS chặt.
- `jobs` — job theo tháng (`thang` dạng `YYYY-MM`).
- `castings` — bảng nối talent ↔ job (1 talent nhiều job = nhiều dòng). Chứa vai, kết quả, tiền, OT.

Quan hệ: 1 talent — N castings; 1 job — N castings. Dedup talent theo `id` (nội bộ) và cảnh báo trùng theo SĐT khi nhập (query `talent_contacts`).

## 4. Màn hình (bê nguyên logic bản artifact hiện có, chỉ đổi nguồn data sang Supabase)
1. **Login** — Supabase Auth.
2. **Dashboard tháng** — chọn tháng → chỉ số (lượt casting, talent unique, talent ≥2 job, đậu, tổng HĐ/OT/thanh toán), bảng theo job, biểu đồ cột (thanh toán/job) + tròn (casting/job). Nút xuất Excel tháng.
3. **Jobs** — list job theo tháng, thêm/sửa/xoá job; vào 1 job để quản lý casting (thêm talent, chỉnh vai/kết quả/tiền/OT inline).
4. **Talent directory** — tìm kiếm, thêm/sửa; hiện số job đã làm + tổng tiền nhận; **SĐT ẩn mặc định**, chỉ manager bấm hiện. Có bộ lọc `status` (pending/approved) + nút duyệt cho manager.
5. **(tuỳ chọn) Duyệt talent** — hàng chờ `pending` cho manager duyệt.

Logic tính toán (giữ y bản cũ):
- talent unique = distinct talent_id trong tháng.
- talent trùng = talent có ≥2 job phân biệt trong tháng.
- Tổng thanh toán = Σ(so_tien_hd + chi_phi_ot) của casting `Đậu`.

## 5. Thứ tự thực thi cho Claude Code
1. Chạy `supabase_schema.sql` lên project (qua Supabase SQL Editor hoặc `supabase db push`). Verify RLS bật đủ.
2. Tạo route group `/talent` trong Next.js app, thêm Supabase server/client helper.
3. Dựng auth + middleware bảo vệ `/talent/*`.
4. Build lần lượt: Talent directory → Jobs → Job detail/casting → Dashboard. Test CRUD từng cái với 1 account thật.
5. Seed vài dòng mẫu để test, rồi xoá.
6. Test 2 account khác role (staff vs manager) để verify: staff KHÔNG thấy SĐT, KHÔNG duyệt được; manager thấy + duyệt được.
7. Set env trên Vercel, deploy, test link production.

## 6. Việc cần Jen chuẩn bị / xử lý ngoài code
- Resolve GitHub account `JenNaito-hub` để Vercel connect repo (đây là blocker cũ).
- Có sẵn Supabase URL + anon key (Settings → API).
- Tạo trước vài account nhân viên trong Supabase Auth, gán role trong bảng `profiles`.

## 7. Ngoài phạm vi đợt này (làm sau)
- Nối tool đọc comcard (cần Anthropic key ở server route, không để lộ client).
- Import từ Excel bản cũ.
- Phân quyền theo từng job / audit log.
