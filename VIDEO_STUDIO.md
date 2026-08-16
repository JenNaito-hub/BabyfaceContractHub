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

**Ảnh tham chiếu** (tối đa 4): chọn ảnh sản phẩm, talent hoặc bối cảnh từ Thư viện. Claude nhìn
ảnh rồi mới viết, nên shotlist bám đúng màu sắc và kiểu dáng thật thay vì tả chung chung — và
prompt AI cũng tả lại đặc điểm nhìn thấy được. Ảnh được thu nhỏ về 1024px trước khi gửi.

Nút **“Dựng khung trong Editor”** biến shotlist thành project: mỗi cảnh là một clip trống mang
sẵn chữ mô tả, đúng thời lượng, **và kèm luôn prompt tiếng Anh của cảnh đó**.

### 5. Sinh ảnh/video bằng AI (fal.ai)
Trong Editor, chọn một clip → **“✨ Sinh media bằng AI”**. Prompt tự điền từ shotlist, tỉ lệ
khung hình lấy theo project. Sinh xong file tự vào Thư viện và tự gắn vào clip đang chọn.

Cần `FAL_KEY`. Thiếu key thì nút báo rõ là chưa cấu hình, các phần khác vẫn chạy bình thường.

Video sinh ra **5 hoặc 10 giây mỗi lần** (giới hạn của model, không phải của app) — nút ghi rõ
sẽ ra mấy giây. Cảnh dài hơn thì sinh nhiều lần rồi ghép trên timeline.

**Clip đang gắn ảnh** thì có thêm lựa chọn *“Dùng ảnh của clip làm gốc”* — video dựng từ chính
ảnh đó (image-to-video) nên giữ đúng sản phẩm/người trong ảnh, thay vì để model vẽ ra một thứ
na ná.

**Ảnh rẻ hơn video rất nhiều.** Cách tiết kiệm: sinh ảnh cho từng cảnh rồi bật *Zoom chậm* +
chuyển cảnh — vẫn ra video có chuyển động với chi phí gần như không đáng kể. Chỉ sinh video
thật cho vài cảnh cần chuyển động phức tạp.

Model đổi được bằng biến môi trường (`FAL_IMAGE_MODEL`, `FAL_VIDEO_MODEL`,
`FAL_IMAGE_TO_VIDEO_MODEL`) — fal ra model mới liên tục, đổi không cần sửa code.

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

## Chạy trên máy

Cần **Node 22 trở lên** (`@supabase/supabase-js` yêu cầu vậy — kiểm tra bằng `node -v`).

```bash
npm install
npm run dev          # http://localhost:3000/video
```

Không cần Supabase, không cần API key nào. Xuất video chạy được vì `localhost`
được trình duyệt coi là môi trường an toàn.

## Cấu hình

Chỉ cần biến này, và chỉ cho phần Kịch bản AI:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Không prefix `NEXT_PUBLIC_` — key chỉ dùng ở server route, không lộ ra client.

## Vào app bằng cách nào

| Từ đâu | Đường đi |
| --- | --- |
| Domain gốc `/` | Trang chọn app → bấm **Video Studio** |
| Trang đăng nhập `/login` | Link **“Mở Video Studio”** ở cuối trang |
| Đang dùng Talent Manager | Nút **“Video Studio ↗”** trên thanh nav |
| Trực tiếp | `/video` |

Video Studio **không cần đăng nhập**. Talent Manager thì cần.

## Deploy lên Vercel

Video Studio đi chung repo với Talent Manager nên **không cần project Vercel riêng** — deploy
như bình thường là có luôn `/video`.

1. **Merge nhánh** `claude/video-app-b14ooc` vào nhánh chính.
2. **Thêm biến môi trường** trong Vercel → Settings → Environment Variables:

   | Biến | Bắt buộc | Môi trường |
   | --- | --- | --- |
   | `ANTHROPIC_API_KEY` | Không — thiếu thì Kịch bản AI chạy bản offline | Production + Preview |
   | `FAL_KEY` | Không — thiếu thì tắt phần sinh ảnh/video AI | Production + Preview |

   Hai biến `NEXT_PUBLIC_SUPABASE_*` vẫn giữ nguyên cho khu `/talent`.
   **Đừng** đặt tên biến Anthropic có prefix `NEXT_PUBLIC_` — làm vậy là lộ key ra client.

3. **Deploy**, rồi mở `https://<domain>/video`.

### Nghiệm thu trên domain thật

Chạy nhanh 5 bước này sau khi deploy:

- [ ] `/video` mở được **mà không cần đăng nhập** (khác `/talent` — vào là bị đá về `/login`).
- [ ] `/video/media` upload được 1 ảnh và 1 clip; ảnh thumbnail hiện ra.
- [ ] `/video/editor` tạo project, thêm clip, bấm **Xuất video** → tải về file mở xem được.
- [ ] `/video/script` nhập brief → nếu đã cắm key thì badge hiện **Claude**, chưa cắm thì
      hiện **Offline** kèm thông báo. Cả hai đều phải ra shotlist.
- [ ] `/video/backup` xuất `.zip`, mở thử bằng WinRAR/Finder để chắc file không rỗng.

> Xuất video dùng `MediaRecorder` nên **phải chạy trên HTTPS** (hoặc `localhost`). Domain
> Vercel đã có sẵn HTTPS nên không cần làm gì thêm.

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
- **Phần sinh media qua fal.ai chưa chạy thử với API thật** — môi trường build chặn truy cập
  `fal.ai`. Đã kiểm thử: chặn SSRF, thiếu key, thiếu prompt, lỗi mạng, và giao diện không kẹt
  khi lỗi. Model ID mặc định lấy theo tài liệu công khai; nếu fal đổi tên model thì route trả
  lỗi 404 kèm hướng dẫn — sửa bằng biến môi trường, không cần đụng code.
- Sinh ảnh/video **tốn tiền theo lượt** và tiền trả cho fal.ai, không phải cho app này.
