# Phase 1 — một app duy nhất, bán được hàng thật

Cập nhật 2026-08-15. Tài liệu này nói chính xác cái gì chạy được và cái gì chưa,
không làm tròn lên.

Phase 0 dựng nền (database, phân quyền, đăng nhập). Phase 1 gộp app bán hàng vào
AESCENTIC OS thành **một app duy nhất** và làm cho nó bán được hàng thật.

## Đã xong và đã kiểm chứng

| Hạng mục | Bằng chứng |
| --- | --- |
| Nghiệp vụ bán hàng trong schema `os` | migration `0003_sales_operations`: 13 bảng, trigger trừ/hoàn kho |
| Bán tại quầy (POS) | e2e: thêm hàng → thanh toán → tồn kho giảm thật |
| Đơn hàng: danh sách, lọc, tìm, chi tiết | e2e: tìm theo mã đơn còn đúng 1 dòng |
| Kho: tồn theo địa điểm, sổ kho, kiểm kho | test: kiểm kho ghi chênh lệch + bắt buộc có lý do |
| Nhập đơn từ file sàn (Shopee/TikTok) | e2e: nhập file CSV thật, gộp dòng, chặn SKU lạ |
| Nhập lại cùng file không nhân đôi đơn | e2e: lần 2 báo "0 đơn mới", bỏ qua đơn đã có |
| Khách hàng tự sinh theo số điện thoại | trigger `fn_link_customer`, số điện thoại được chuẩn hoá |
| Bảng điều khiển doanh thu theo ngày/kênh | e2e: CEO thấy doanh thu + lợi nhuận gộp |
| Giá vốn chỉ người có quyền mới thấy | e2e: nhân viên bán lẻ không thấy cột giá vốn ở bất kỳ màn nào |
| Phạm vi dữ liệu theo cửa hàng | e2e: nhân viên Thảo Điền không thấy đơn Đồng Khởi |
| Thiếu quyền ra trang giải thích, không phải lỗi 500 | e2e: `/pos` với kế toán → `/khong-du-quyen` |
| Tồn kho không bao giờ âm | migration `0005`: chặn trong hàm + ràng buộc CHECK |
| Giao diện dùng được trên điện thoại | e2e: 3 màn chính không tràn ngang ở 390px |

**83/83 test** (unit + tích hợp trên PostgreSQL thật) và **73/73 kiểm thử
đầu-cuối trên trình duyệt**, chạy lại nhiều lần cho cùng kết quả.

## Những lỗi thật đã tìm ra và sửa trong phase này

Ghi lại vì đây là loại lỗi im lặng làm sai tiền, khó phát hiện khi dùng:

1. **"Hoàn thành" bị đọc thành "hoàn hàng".** Hàm ánh xạ trạng thái sàn xét
   `/hoàn/` trước `/hoàn thành/`, nên **mọi đơn Shopee thành công sẽ được nhập
   vào thành đơn trả hàng** — doanh thu mất trắng, tồn kho cộng ngược. Đã sửa
   thứ tự và có test riêng khoá lại.

2. **Tồn kho có thể âm.** Đường bán hàng kiểm tra đủ hàng, nhưng kiểm kho,
   chuyển kho hay một câu SQL gọi tay đều đẩy được số dư xuống âm. Đã chặn ngay
   trong `fn_apply_stock_move` và thêm ràng buộc CHECK làm lưới cuối.

3. **Kế toán được cấp `product.cost` nhưng không có `product.read`.** Quyền xem
   giá vốn là quyền chồng lên quyền xem sản phẩm; thiếu quyền nền thì cả hai màn
   hình đều đóng và quyền kia thành vô dụng. Đã sửa ở `0006` và thêm test quét
   toàn bộ vai trò để không tái diễn.

4. **Danh sách khách hàng không áp phạm vi.** Nhân viên một cửa hàng đọc được
   toàn bộ danh sách khách của công ty. Đã lọc theo nơi khách từng mua.

5. **Luật "ai quản kho hàng bán" nằm ở hai nơi.** Câu `UPDATE` trong `0003` chạy
   trước khi seed tạo địa điểm nên không chạm dòng nào. Đã đưa thành hàm
   `os.kho_ban_do_ai_quan()` để migration, seed và test hỏi cùng một chỗ.

## Nhanh.vn: vẫn là nguồn sự thật, chưa nối được

Theo ADR-0001, Nhanh.vn giữ vai trò nguồn sự thật cho đơn bán lẻ và tồn kho bán
được. Chưa có credential nên **hiện tại OS tự quản kho hàng bán** để Jen còn bán
được hàng.

Việc chuyển giao **không cần sửa code**: khi Nhanh.vn đồng bộ thành công lần
đầu, trigger `trg_dong_bo_doi_chu_kho` (migration `0004`) tự đổi
`managed_by` sang `'nhanh'`, ghi một dòng nhật ký, và từ đó mọi thao tác ghi tồn
kho của OS vào kho hàng bán đều bị database từ chối. Có test chứng minh.

Cần: `NHANH_APP_ID`, `NHANH_BUSINESS_ID`, `NHANH_ACCESS_TOKEN`. Xem
`../integrations/credentials-needed.md`.

## Còn lại

| Hạng mục | Vì sao chưa | Ước lượng |
| --- | --- | --- |
| Đối soát COD | Còn ở app cũ (`src/lib/sales/cod.ts`), chưa chuyển sang OS | ~0,5 lượt |
| In phiếu giao hàng | Còn ở app cũ, chưa chuyển sang OS | ~0,5 lượt |
| Xuất Excel báo cáo | Chưa làm ở OS | ~0,3 lượt |
| Nhập/chuyển kho có giao diện | Database và trigger đã có, chưa có màn hình | ~0,7 lượt |
| `apps/worker` đọc outbox | Cần `REDIS_URL`. Hàng chờ đang dồn lại, chưa ai rút | ~0,5 lượt |
| Nối Nhanh.vn thật | Chờ credential của Jen | ~1 lượt sau khi có token |

### Hàng chờ sự kiện đang dồn

Mỗi đơn hàng phát một domain event vào `os.domain_events`. Chưa có worker nào
rút ra nên hàng chờ chỉ dài thêm. Chưa gây hại (chưa có tính năng nào phụ thuộc
vào nó) nhưng phải xử lý trước khi chạy thật lâu dài.

## Quan hệ với app Aescentic Sales cũ

App bán hàng ở thư mục gốc **vẫn còn nguyên và vẫn chạy**, nhưng phần lớn chức
năng của nó đã có trong AESCENTIC OS. Hai thứ chưa chuyển sang là **đối soát
COD** và **in phiếu giao hàng** — nên chưa xoá app cũ. Xoá bây giờ là mất tính
năng đang dùng được.

Phần đọc file sàn và tách địa chỉ **đã được chuyển hẳn** sang
`aescentic-os/packages/marketplace/`, kèm 23 test. Bản ở app cũ giữ nguyên để app
cũ còn chạy, nhưng bản dùng cho tương lai là bản trong OS.

## Cách kiểm chứng lại

```bash
cd aescentic-os
export DATABASE_URL="postgres://postgres@127.0.0.1:5434/aescentic_os"
npm install
npm run db:migrate && npm run db:migrate   # lần 2 phải báo "không có migration mới"
npm run db:seed && npm run db:seed         # lần 2 không được nhân đôi dữ liệu
npx tsx packages/database/src/seed-sales.ts # dữ liệu bán hàng mẫu, chạy lại không nhân đôi
npm test                                    # 83/83
npx tsc --noEmit                            # không lỗi

# Vỏ web + kiểm thử trình duyệt
export AUTH_SECRET="chuoi-dai-hon-32-ky-tu"
export ALLOW_DEV_LOGIN=true
npm --workspace @aescentic/web run dev      # http://localhost:3100
node apps/web/e2e.mjs                       # 73/73
```

Đăng nhập nhanh theo tài khoản mẫu **chỉ chạy ở chế độ dev**: `NODE_ENV=production`
là tắt cứng, kể cả khi có `ALLOW_DEV_LOGIN=true`. Đây là chốt chặn có chủ ý.
