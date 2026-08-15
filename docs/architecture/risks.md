# Rủi ro kiến trúc

Xếp theo mức độ có thể làm hỏng dự án, không theo xác suất.

## R1 — Hai nguồn cùng ghi tồn kho *(nghiêm trọng)*

Nếu Nhanh.vn và OS cùng trừ một kho, tồn lệch trong vòng một ngày và không ai
biết bên nào đúng. Đây là cách phổ biến nhất khiến dự án ERP mất niềm tin.

**Giảm thiểu:** mỗi `inventory_location` có cột `managed_by` (`nhanh` | `os`).
Ràng buộc ở database: giao dịch kho do OS sinh ra **không được** chạm vào location
`managed_by = 'nhanh'`. Vi phạm thì trigger raise, không phải chỉ code review.

## R2 — Lương và hoa hồng tính sai *(nghiêm trọng)*

Sai lương là mất niềm tin của nhân viên, và rất khó lấy lại. Rủi ro cao vì công
thức phụ thuộc chuỗi dài: chấm công → KPI → hoa hồng → lương.

**Giảm thiểu:**
- Mọi dòng lương lưu **snapshot đầu vào** (`inputs jsonb`) chứ không chỉ kết quả —
  đổi quy tắc sau này không làm thay đổi lương đã trả.
- Quy tắc có `effective_from/to`; kỳ lương dùng đúng phiên bản quy tắc tại kỳ đó.
- Mọi giá trị dẫn xuất phải drill-down được tới chứng từ gốc.
- Workflow duyệt 5 bước, không ai một mình chốt được.
- Test bắt buộc: cùng đầu vào → cùng kết quả, và tổng các dòng = tổng kỳ.

## R3 — Không có credential tích hợp *(chắc chắn xảy ra)*

Nhanh.vn, Zalo OA, HĐĐT, kế toán đều cần tài khoản và duyệt từ phía nhà cung cấp.
Không có thì không code được phần thật.

**Giảm thiểu:** mọi tích hợp có interface + mock provider + integration test chạy
với mock. Hệ thống chạy đầy đủ ở chế độ mock. Có bảng ghi rõ **thiếu credential nào**
(`docs/integrations/credentials-needed.md`). Không bao giờ để code giả vờ đã tích hợp.

## R4 — Phạm vi quá lớn so với nguồn lực *(chắc chắn xảy ra)*

19 module, 9 phase. Với một người + AI, làm tất cả cùng lúc sẽ cho ra 19 thứ dở dang.

**Giảm thiểu:** lát cắt dọc, Definition of Done nghiêm, và chấp nhận rằng nhiều
module sẽ *chưa bắt đầu* trong thời gian dài. Một module dùng được tốt hơn năm
module nửa vời. Roadmap có mục "cố tình chưa làm" để chống trôi phạm vi.

## R5 — RBAC đúng ở API nhưng sai ở dữ liệu *(cao)*

Lỗi kinh điển: kiểm `user.can('inventory.read')` rồi query cả công ty, trong khi
người đó chỉ được xem cửa hàng mình.

**Giảm thiểu:** `authorize()` trả về **bộ lọc dữ liệu** chứ không chỉ boolean.
Repository nhận scope làm tham số bắt buộc. Test viết theo hướng "nhân viên cửa
hàng A không được thấy dữ liệu cửa hàng B", không phải "gọi API có 200 không".

## R6 — AI trả lời sai chính sách công ty *(cao)*

Nhân viên hỏi về nghỉ phép, AI bịa ra chính sách → tranh chấp lao động thật.

**Giảm thiểu:** RAG chỉ index tài liệu **đã duyệt và còn hiệu lực**. Mọi câu trả
lời chính sách phải kèm nguồn + phiên bản + ngày hiệu lực. Không tìm thấy thì trả
đúng câu *"Không tìm thấy chính sách chính thức."* và chuyển người thật. Cấm
fallback sang kiến thức chung của model cho câu hỏi chính sách.

## R7 — Gộp nhầm khách hàng *(trung bình)*

Khách đến từ POS, Zalo, Mini App, sàn. Gộp theo SĐT là đúng phần lớn, nhưng SĐT
dùng chung trong gia đình, hoặc khách đổi số, sẽ gộp nhầm — kéo theo lịch sử mua
và điểm loyalty của người khác.

**Giảm thiểu:** `customer_identity` lưu từng danh tính nguồn riêng, gộp là **liên
kết chứ không phá huỷ**. Có thao tác tách lại. Gộp tự động chỉ khi trùng SĐT *và*
không mâu thuẫn tên; còn lại đưa vào hàng chờ người duyệt.

## R8 — Migration làm hỏng dữ liệu thật *(trung bình, hậu quả nặng)*

**Giảm thiểu:** migration chỉ tiến, chạy được hai lần không lỗi, và mọi migration
đụng dữ liệu tài chính phải có script kiểm tra trước/sau. Backup trước khi chạy
trên production — ghi thành checklist, không dựa vào trí nhớ.

## R9 — Chi phí AI vượt kiểm soát *(thấp, dễ quên)*

CEO AI + concierge khách hàng + RAG có thể tốn hơn dự tính rất nhiều nếu không đo.

**Giảm thiểu:** `ai_interaction` ghi token và chi phí ước tính mỗi lần gọi. Có
hạn mức theo vai trò. Dashboard chi phí AI trong admin health.

## R10 — Khoá vào Supabase *(thấp)*

**Giảm thiểu:** phần Postgres là chuẩn, chuyển đi được. Ràng buộc thật chỉ ở Auth
và Storage — đã bọc sau `packages/auth` và interface storage, đổi được mà không
đụng domain logic.
