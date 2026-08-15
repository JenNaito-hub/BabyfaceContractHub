# Implementation roadmap

## Nguyên tắc cắt phase

Mỗi phase phải đi hết **một lát cắt dọc**: database → permission → API → UI →
test → docs. Không có phase nào chỉ có UI, cũng không có phase nào chỉ có schema.

Phase chỉ được coi là xong khi đạt đủ Definition of Done ở `target-state.md`.

## Phase 0 — Foundation *(đang làm)*

Xây nền móng mà 19 module đều dựa vào.

| Hạng mục | Nội dung |
| --- | --- |
| Monorepo | workspace, tsconfig chung, eslint chặn import xuyên tầng |
| Database | Drizzle + migration SQL cho identity, org, catalog rút gọn, platform |
| Auth | Supabase Auth → ctx người dùng có role + permission + scope |
| RBAC | `resource.action.scope`, evaluator trả về cả bộ lọc dữ liệu |
| Audit | `audit_log` + helper, bắt buộc cho tiền/kho/quyền |
| Config | `config_setting` có `effective_from/to`, đọc theo thời điểm |
| Events | domain event + outbox, chưa cần Redis vẫn chạy được |
| Integration | `POSProvider` interface + `MockNhanhProvider` + sync state |
| Seed | 6 cửa hàng, kho trung tâm, 20 nhân viên, 17 vai trò, 30 SP |
| Tests | permission, scope, config effective-dating, audit, migration |

**DoD:** hệ thống khởi động · migration chạy · đăng nhập được · quyền chặn đúng ·
audit ghi đúng · test xanh.

## Phase 1 — Retail core

Nhanh.vn adapter thật · Product Master đầy đủ (fragrance profile, training,
lifecycle) · đồng bộ đơn/tồn/khách · dashboard cửa hàng · báo cáo ngày/tuần ·
CEO dashboard bản cơ bản.

**Phụ thuộc:** Phase 0. **Chặn bởi:** credential Nhanh.vn — cho tới lúc có, chạy
`MockNhanhProvider` và fallback POS.

## Phase 2 — People

Workforce · lịch ca · nghỉ phép · chấm công · KPI engine · commission rules ·
payroll với workflow duyệt 5 bước · payslip · income simulator.

Đây là phase **rủi ro cao nhất về tính đúng đắn**: mọi con số phải truy ngược
được tới chứng từ gốc. Xem `risks.md`.

## Phase 3 — Customer

Customer 360 · gộp danh tính đa nguồn · loyalty · Scent ID · CRM tasks ·
Zalo OA inbox · customer care.

## Phase 4 — Marketing
Campaign · promotion · gift · voucher · segmentation · broadcast · analytics ROI.

## Phase 5 — Supply
Procurement · production · BOM · batch · QC · truy vết batch → khách hàng.

## Phase 6 — Finance
Invoice + HĐĐT qua nhà cung cấp · expense · budget · P&L cửa hàng · cash-flow ·
xuất kế toán.

## Phase 7 — B2B
Pipeline · site survey · quotation versioning · contract · machine asset ·
maintenance · refill · receivable · commission theo tiền đã thu · BNI.

## Phase 8 — Zalo Mini App
MVP: member, shop, product, Scent Finder, tồn kho cửa hàng, đơn, chăm sóc.
Sau đó: AI Concierge, Scent Wardrobe, Passport, gift, refill, cá nhân hoá,
clienteling.

## Phase 9 — AI Intelligence
RAG knowledge · CEO AI · phát hiện bất thường · dự báo · gợi ý · Voice of
Customer · tối ưu tồn kho và nhân sự.

## Thứ tự này có bắt buộc không

Phase 0 → 1 → 2 bắt buộc theo thứ tự: không có nền thì không có retail, không có
retail thì KPI không có dữ liệu.

Từ Phase 3 trở đi có thể đổi thứ tự theo ưu tiên kinh doanh. Nếu B2B đang là
nguồn doanh thu tăng nhanh hơn bán lẻ thì kéo Phase 7 lên trước Phase 4–6 —
kiến trúc không cản.

## Cái gì cố tình chưa làm

- Microservice. Xem ADR-0002.
- Realtime từng giây cho dashboard. Đồng bộ theo chu kỳ là đủ cho quyết định điều hành.
- Tự phát hành hoá đơn điện tử. Dùng nhà cung cấp có chứng nhận.
- Tự viết sổ sách kế toán. Xuất sang phần mềm kế toán.
- App di động native. Web responsive trước; Mini App phủ phía khách hàng.
