# ADR-0001 — Nhanh.vn là nguồn giao dịch, OS không ghi đè

**Trạng thái:** Chấp nhận · 2026-08-15

## Bối cảnh

Bản Aescentic Sales vừa xây là bản *thay thế* Nhanh.vn: có POS riêng, tự trừ kho,
tự sinh mã đơn. Master prompt của AESCENTIC OS yêu cầu ngược lại — giữ Nhanh.vn
làm POS chính và tích hợp vào.

Không thể có hai hệ thống cùng là nguồn sự thật cho tồn kho và đơn hàng. Nếu cả
hai cùng ghi, tồn sẽ lệch trong vòng một ngày và không ai biết bên nào đúng.

## Quyết định

Nhanh.vn là **system of record** cho: đơn bán lẻ, thanh toán tại quầy, tồn kho
hàng bán, khách hàng phát sinh từ POS.

AESCENTIC OS là **system of intelligence + workflow**: đọc dữ liệu về, làm giàu
thêm, và sở hữu những thứ Nhanh.vn không có.

Cụ thể:

| Dữ liệu | Ghi ở đâu | OS làm gì |
| --- | --- | --- |
| Đơn bán lẻ | Nhanh.vn | Đọc về, gắn KPI/hoa hồng/campaign attribution |
| Tồn kho hàng bán | Nhanh.vn | Đọc về, phân tích velocity, đề xuất chuyển kho |
| Kho tester / quà / hàng hỏng | **OS** | Nhanh không có khái niệm này |
| Khách hàng | Cả hai, gộp theo SĐT | OS bổ sung Scent ID, LTV, segment |
| Đơn B2B, hợp đồng, máy | **OS** | Nhanh không có |
| Nhân sự, ca, lương, KPI | **OS** | |

Bản ghi đồng bộ từ Nhanh mang cờ `source = 'nhanh'` và **chỉ đọc** trong OS.
Sửa phải sửa bên Nhanh rồi đồng bộ lại. UI phải nói rõ điều này.

## Fallback mode

POS của bản hiện tại **không xoá**. Nó chuyển thành đường bán phụ cho:

- bán sự kiện / pop-up nơi không có máy POS Nhanh,
- bán B2B và bán sỉ,
- giai đoạn chưa nối được API Nhanh (chưa có credential).

Đơn tạo ở fallback mang `source = 'os'` và **tự trừ kho như hiện tại**. Hai nguồn
không bao giờ trừ cùng một kho: kho Nhanh và kho OS là các `InventoryLocation`
khác nhau, có cờ `managed_by`.

## Hệ quả

- Phải có `external_ref` (id bên Nhanh) trên order/product/customer/inventory để
  đồng bộ idempotent.
- Phải có bảng `integration_sync_state` để biết đồng bộ tới đâu, lỗi gì.
- Xung đột dữ liệu phải có chính sách rõ: **Nhanh thắng** cho các trường Nhanh sở
  hữu; OS thắng cho các trường chỉ OS có.
- Cho đến khi có credential Nhanh.vn, hệ thống chạy hoàn toàn ở fallback mode.
  `MockNhanhProvider` cho phép phát triển và test toàn bộ luồng mà không cần API thật.

## Rủi ro đã biết

Nếu Nhanh.vn không cung cấp webhook, đồng bộ sẽ theo chu kỳ (polling) và dashboard
có độ trễ. Chấp nhận được: quyết định điều hành không cần realtime từng giây.
