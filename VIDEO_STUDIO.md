# Babyface Video Studio (`/video`)

App làm video **độc lập** trong repo này. Không dùng chung login hay dữ liệu với khu `/talent`
— mở `/video` là chạy được ngay, kể cả khi chưa cấu hình Supabase.

Toàn bộ file và dự án nằm trong **IndexedDB của trình duyệt**, không upload lên server.
Đổi máy hoặc đổi trình duyệt sẽ không thấy dữ liệu cũ.

## Bốn phần

### 1. Editor — dựng video bằng tay (`/video/editor`)
Ghép clip/ảnh thành timeline, mỗi clip chỉnh được:

- Thời lượng, cắt từ giây nào (video), zoom chậm kiểu Ken Burns
- Khung hình `cover` / `contain`, chuyển cảnh: cắt thẳng · mờ dần · trượt ngang
- Chữ chèn lên clip: 2 dòng, 5 kiểu dựng sẵn, vị trí/cỡ/màu, hiện sau N giây và giữ bao lâu
- Tiếng gốc của video: tắt/bật, chỉnh âm lượng
- Gắn / đổi media của clip bất cứ lúc nào

Thao tác timeline: **kéo thả** đổi thứ tự (hoặc nút ← →), **✂ cắt đôi tại playhead**,
**nhân bản** clip, xoá clip.

Cấp project: khung hình (9:16 · 1:1 · 16:9 · 4:5), FPS, màu nền, nhạc nền (bắt đầu từ giây thứ
mấy, âm lượng, nhỏ dần ở cuối), logo/watermark (vị trí, kích thước, độ mờ).

**Xuất file**: `Xuất video` phát lại timeline theo thời gian thực và ghi bằng `MediaRecorder`
→ tải về MP4 (nếu trình duyệt hỗ trợ) hoặc WebM. `Lưu khung hình` xuất PNG tại vị trí đang xem.

> Xuất chạy real-time: video 30 giây mất khoảng 30 giây. Giữ tab ở trước trong lúc xuất,
> chuyển tab sẽ làm trình duyệt giảm nhịp vẽ và rớt khung hình.

### 2. Showreel tự động (`/video/showreel`)
Chọn talent trong hồ sơ → chọn template → app tự dựng timeline (thẻ tên, chuyển cảnh, nhạc)
rồi mở thẳng trong Editor để chỉnh và xuất.

4 template: **Casting Card** (thẻ tên, gửi client duyệt) · **Punch Reel** (cắt nhanh cho
Reels/TikTok) · **Lookbook** (chậm, cho portfolio) · **Clean Cut** (không chữ).

### 3. Kịch bản AI (`/video/script`)
Nhập brief → nhận logline, hook 3 giây đầu, voiceover, shotlist (cỡ cảnh, chuyển máy, thời
lượng, âm thanh) và **prompt tiếng Anh** cho công cụ sinh video AI (Veo, Runway, Sora).

Dùng Claude (`claude-opus-5`) qua server route `/api/video/script`, ràng buộc output bằng
JSON schema nên kết quả luôn đúng cấu trúc. **Chưa có `ANTHROPIC_API_KEY` thì app vẫn chạy** —
tự chuyển sang bản sinh offline bằng template, cho ra khung shotlist dùng được ngay.

Nút **“Dựng khung trong Editor”** biến shotlist thành project: mỗi cảnh là một clip trống mang
sẵn chữ mô tả và đúng thời lượng. Vào Editor gắn footage vào từng clip là ra bản dựng.

### 4. Quản lý sản xuất (`/video/production`)
Dự án quay: trạng thái (lên kế hoạch → quay → dựng → chờ duyệt → xong), khách hàng, ngân sách,
ê-kíp, ngày quay (ngày, call time, địa điểm), và deliverable kèm spec, hạn, link review,
trạng thái duyệt.

Mỗi deliverable **nối được với một project trong Editor** — mở chi tiết dự án là bấm thẳng vào
bản dựng tương ứng.

### Phụ trợ
- **Thư viện** (`/video/media`) — upload video/ảnh/nhạc, xem dung lượng đã dùng.
- **Talent** (`/video/talents`) — hồ sơ riêng của app video: tên, vai, ghi chú, tag, ảnh/clip.
  Cố ý **không** có số điện thoại hay dữ liệu nhạy cảm — phần đó thuộc `/talent` và được RLS bảo vệ.
- **Sao lưu** (`/video/backup`) — xuất toàn bộ dữ liệu ra một file `.zip` (kèm hoặc không kèm
  media), khôi phục theo kiểu *gộp* hoặc *thay thế*, và nút xoá sạch. **Đây là cách duy nhất
  giữ dữ liệu ngoài trình duyệt** — nên xuất định kỳ và trước khi đổi máy.

## Luồng dùng thực tế

```
Brief  →  Kịch bản AI  →  “Dựng khung trong Editor”  →  gắn footage  →  Xuất video
                                                              ↑
Talent + ảnh/clip  →  Showreel tự động  ──────────────────────┘

Dự án sản xuất  →  deliverable  →  nối tới project  →  mở Editor
```

## Cấu hình

Chỉ cần biến này, và chỉ cho phần Kịch bản AI:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Không prefix `NEXT_PUBLIC_` — key chỉ dùng ở server route, không lộ ra client.

## Hỗ trợ trình duyệt

| Tính năng | Yêu cầu |
| --- | --- |
| Dựng, preview, lưu dự án | Trình duyệt hiện đại bất kỳ |
| Xuất video | `MediaRecorder` + `canvas.captureStream` — Chrome/Edge tốt nhất |
| Xuất MP4 | Chrome/Edge bản mới; nơi khác tự động rơi về WebM |

Editor hiện định dạng trình duyệt sẽ dùng ngay trong panel bên phải.

## Kiến trúc

```
src/app/video/…            trang (layout riêng, nav riêng)
src/app/api/video/script/  server route gọi Claude
src/components/video/…     UI client
src/lib/video/
  types.ts       kiểu dữ liệu
  db.ts          IndexedDB (assets + blobs + projects/talents/productions/scripts)
  render.ts      engine: MediaPool · drawFrame · Player · exportProject
  templates.ts   template showreel · storyboard từ shotlist · kịch bản offline
  zip.ts         đọc/ghi .zip (method store) — không dùng thư viện ngoài
  backup.ts      đóng gói / khôi phục toàn bộ dữ liệu
  hooks.ts       hook nạp dữ liệu
```

Engine không dùng thư viện ngoài — canvas 2D để dựng hình, Web Audio để trộn tiếng,
`MediaRecorder` để ghi. Không cần ffmpeg.wasm, không cần server render.

## Giới hạn đã biết

- Xuất chạy **real-time**, không nhanh hơn thời lượng video được.
- Dữ liệu nằm trong trình duyệt: xoá dữ liệu duyệt web là mất. Dùng `/video/backup` để giữ.
- File `.zip` sao lưu không nén (media vốn đã nén sẵn) — dung lượng xấp xỉ tổng media.
- Crossfade dùng vị trí gần đúng của clip trước, sai số dưới một khung hình — đủ cho chuyển cảnh,
  không dùng để canh khớp hình chính xác từng frame.
- Route `/api/video/script` đã kiểm thử ở nhánh không có key (rơi về offline); nhánh gọi Claude
  thật cần cắm `ANTHROPIC_API_KEY` để chạy thử.
