# Integration map

## Nguyên tắc

Code riêng của từng nhà cung cấp **không được rò rỉ ra ngoài** `packages/integrations`.
Domain module chỉ thấy interface. Đổi nhà cung cấp = viết adapter mới, không sửa
nghiệp vụ.

```
modules/retail  ──▶  POSProvider (interface)  ──▶  NhanhProvider
                                              └─▶  MockPosProvider
```

## Danh sách tích hợp

| Hệ thống | Interface | Adapter | Chiều | Trạng thái |
| --- | --- | --- | --- | --- |
| Nhanh.vn | `POSProvider` | `NhanhProvider` | đọc về | ⏳ chờ credential |
| Nhanh.vn (dev) | `POSProvider` | `MockPosProvider` | — | ✅ dùng được |
| Zalo OA | `MessagingProvider` | `ZaloOAProvider` | hai chiều | ⏳ chờ credential |
| Zalo Mini App | `MiniAppAuthProvider` | `ZaloMiniAppProvider` | đọc | ⏳ chờ credential |
| Hoá đơn điện tử | `EInvoiceProvider` | chọn NCC sau | gửi đi | ⏳ chưa chọn NCC |
| Kế toán | `AccountingExporter` | `CsvExporter` | xuất | ✅ CSV dùng được ngay |
| Vận chuyển | `ShippingProvider` | `GhtkProvider` | hai chiều | ⚠️ đã code, chưa test token thật |
| AI | `AIProvider` | `AnthropicProvider` | gọi | ✅ |

## Quy tắc đồng bộ

1. **Idempotent.** Mọi bản ghi ngoài lưu `(source, external_ref)` unique. Chạy lại
   không tạo trùng.
2. **Có trạng thái.** `integration_sync_state` ghi con trỏ đồng bộ, lần chạy cuối,
   số bản ghi, lỗi. Không đồng bộ mù từ đầu mỗi lần.
3. **Không đồng bộ ngược trừ khi cố ý.** Mặc định OS chỉ đọc. Ghi ngược sang
   Nhanh.vn phải là quyết định riêng cho từng trường.
4. **Lỗi không được nuốt.** Mọi lỗi ghi vào sync state và tạo alert. Đồng bộ thất
   bại phải nhìn thấy được trên admin health, không chỉ nằm trong log.
5. **Backoff.** Retry theo cấp số nhân, có trần. Nhà cung cấp chết không được làm
   worker chết theo.

## Credential đang thiếu

Xem `credentials-needed.md`. Không có credential thì hệ thống vẫn chạy đầy đủ
bằng mock provider — nhưng phải hiển thị rõ trên admin health rằng đang ở chế độ mock.
