# Aescentic Sales — hướng dẫn vận hành

App quản lý bán hàng đa kênh cho Aescentic, thay cho Nhanh.vn / Haravan.
Khu vực chính ở route **`/sales`**. Talent Manager cũ vẫn nằm ở `/talent`, hai app
dùng chung 1 tài khoản đăng nhập.

## Kênh bán được hỗ trợ

| Kênh | Đơn vào hệ thống bằng cách nào |
| --- | --- |
| Shopee | Nhập file Excel/CSV xuất từ Shopee (`Đơn hàng → Nhập file sàn`) |
| TikTok Shop | Nhập file Excel/CSV xuất từ TikTok Shop |
| Facebook / Zalo | Tạo đơn tay — dán nguyên đoạn inbox, app tự tách tên/SĐT/địa chỉ |
| Website | Website POST vào `/api/orders/webhook` (xem mục Webhook) |
| 5 cửa hàng | Màn hình **Bán hàng** (POS) — chọn hàng, thu tiền, trừ kho ngay |

## Các màn hình

- **Tổng quan** — doanh thu theo ngày/kênh/cửa hàng, lợi nhuận gộp, đơn cần xử lý,
  SKU sắp hết. Lọc theo tháng · cửa hàng · kênh. Xuất Excel 6 sheet.
- **Bán hàng (POS)** — bán tại quầy. Tìm SKU, thêm vào giỏ, chọn giá lẻ/giá sỉ,
  nhập SĐT khách để tích lịch sử mua, thanh toán → tồn kho trừ ngay.
- **Đơn hàng** — lọc theo kênh/trạng thái/kho, đổi trạng thái ngay trên bảng,
  vào chi tiết để sửa hàng, gán vận đơn, xem lãi gộp từng đơn.
- **Sản phẩm** — sản phẩm và biến thể (mùi × dung tích). Mỗi biến thể có SKU riêng
  — SKU này phải trùng SKU khai trên Shopee/TikTok thì import mới khớp được.
- **Kho** — bảng tồn theo từng cửa hàng, kiểm kho, sổ kho (mọi phát sinh đều có vết),
  nhập kho, chuyển kho giữa các cửa hàng.
- **Khách hàng** — tự tạo theo SĐT mỗi khi chốt đơn; nhóm lẻ/sỉ/VIP, lịch sử mua.
- **Báo cáo** *(quản lý)* — chọn khoảng ngày bất kỳ, lãi gộp theo kênh và theo SKU,
  COD chưa thu.
- **Cài đặt** *(quản lý)* — đổi tên 5 cửa hàng, thêm kho, gán quyền và cửa hàng cho
  nhân viên.

## Luồng tồn kho

Tồn kho **không sửa tay được** — kể cả gọi thẳng API. Mọi thay đổi đi qua trigger ở
database và đều ghi 1 dòng vào sổ `stock_moves`:

| Việc | Tồn kho |
| --- | --- |
| Phiếu nhập → *Hoàn thành* | Cộng kho, đồng thời cập nhật giá vốn mới cho SKU |
| Đơn → *Đã xác nhận / Đang giao / Hoàn thành* | Trừ kho của cửa hàng bán |
| Đơn → *Mới / Huỷ / Hoàn* | Trả hàng lại kho |
| Chuyển kho → *Gửi đi* | Trừ kho gửi |
| Chuyển kho → *Đã nhận* | Cộng kho nhận |
| Kiểm kho | Ghi chênh lệch giữa số đếm thực tế và số trên hệ thống |

Không đủ hàng thì hệ thống **chặn xác nhận đơn** và báo rõ SKU nào thiếu bao nhiêu.
Đơn đã trừ kho thì khoá dòng hàng — muốn sửa phải chuyển đơn về *Mới* (hàng tự về kho).

Riêng đơn import lịch sử từ sàn có thể bật *"Không trừ tồn kho"* — doanh thu vẫn tính
nhưng kho không đụng tới, vì hàng đã xuất ngoài hệ thống rồi.

## Phân quyền

| | staff | manager | admin |
| --- | :-: | :-: | :-: |
| Bán hàng POS, tạo/sửa đơn | ✅ | ✅ | ✅ |
| Xem tồn kho, sổ kho | ✅ | ✅ | ✅ |
| **Xem giá vốn & lợi nhuận** | ❌ | ✅ | ✅ |
| Nhập kho, chuyển kho, kiểm kho | ❌ | ✅ | ✅ |
| Sửa danh mục sản phẩm, cửa hàng | ❌ | ✅ | ✅ |
| Báo cáo lãi lỗ | ❌ | ✅ | ✅ |
| Xoá đơn | ❌ | ✅ | ✅ |
| Đổi quyền / gán cửa hàng cho nhân viên | ❌ | ❌ | ✅ |

Giá vốn nằm ở 2 bảng riêng (`variant_costs`, `order_item_costs`) với RLS chỉ cho
admin/manager đọc. Staff gọi thẳng API cũng không lấy được. UI chỉ ẩn nút cho gọn;
lớp chặn thật nằm ở database.

## Cài đặt lần đầu

1. **Supabase → SQL Editor** → dán toàn bộ `supabase_sales_schema.sql` → Run.
   File tự tạo sẵn 1 kho online + 5 cửa hàng (`S1`…`S5`).
2. Nâng tài khoản của Jen lên admin:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'jen.aescentic@gmail.com');
   ```
3. Vào **Cài đặt** đổi tên 5 cửa hàng cho đúng, gán nhân viên về từng cửa hàng.
4. Vào **Sản phẩm** khai sản phẩm + SKU. SKU phải khớp SKU trên Shopee/TikTok.
5. Vào **Kho → Nhập kho** tạo phiếu nhập đầu kỳ cho từng cửa hàng để có tồn ban đầu
   (giá nhập ở đây thành giá vốn, dùng để tính lãi).

Chạy local:

```bash
npm install
cp .env.example .env.local   # điền URL + anon key
npm run dev                  # http://localhost:3000/sales
```

## Nhập đơn từ Shopee / TikTok

1. Xuất file đơn trên sàn (Excel hoặc CSV).
2. **Đơn hàng → Nhập file sàn** → chọn kênh → tải file lên.
3. App tự đoán cột. Cột nào đoán sai thì chọn lại trong phần *Ghép cột*.
4. Xem 3 con số: *sẵn sàng import* / *đã có trong hệ thống* / *cần xử lý*.
   Đơn "cần xử lý" gần như luôn là do SKU trên sàn chưa có trong danh mục — tạo SKU
   cho khớp rồi tải lại file.
5. Bấm import. Mã đơn đã có sẵn sẽ tự bị bỏ qua nên **tải lại file cũ không bị trùng**.

## Webhook nhận đơn từ website

Đặt trên Vercel 2 biến môi trường: `SUPABASE_SERVICE_ROLE_KEY` và
`ORDER_WEBHOOK_SECRET`. Thiếu 1 trong 2 thì endpoint trả 501 (tắt hẳn).

```http
POST /api/orders/webhook
Content-Type: application/json
x-webhook-secret: <ORDER_WEBHOOK_SECRET>

{
  "ma_don_san": "WEB-1234",
  "khach_ten": "Nguyễn A",
  "khach_sdt": "0901234567",
  "dia_chi": "123 Lê Lợi, Q.1, TP.HCM",
  "phi_ship": 30000,
  "thanh_toan": "cod",
  "items": [{ "sku": "AMB-50", "so_luong": 1, "don_gia": 890000 }]
}
```

Gọi lại cùng `ma_don_san` sẽ trả về đơn cũ (`"trung": true`) chứ không tạo đơn mới,
nên website retry thoải mái. SKU chưa có trong danh mục thì trả lỗi 400 kèm tên SKU.

## Chưa có trong bản này

- Nối API trực tiếp với Shopee/TikTok (hiện đi qua file Excel).
- Nối API hãng vận chuyển để đẩy đơn và lấy trạng thái tự động (hiện nhập mã vận đơn tay).
- Chương trình khuyến mãi/voucher tự động, tích điểm.
- Kế toán công nợ nhà cung cấp.
