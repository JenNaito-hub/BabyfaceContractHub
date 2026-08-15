/**
 * Kiểm thử đầu-cuối AESCENTIC OS — chạy trên trình duyệt thật, database thật.
 *
 * Không kiểm bằng bảng "quyền của tôi" mà app tự khai: kiểm bằng thứ người dùng
 * thật sự thấy và làm được. Một bảng tự khai đúng mà truy vấn phía dưới quên áp
 * bộ lọc thì test vẫn xanh trong khi dữ liệu đã rò.
 *
 * Cần app đang chạy ở cổng 3100 với ALLOW_DEV_LOGIN=true.
 *   node apps/web/e2e.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.OUT_DIR ?? ".";

let fail = 0;
function kiem(ten, thuc, mong) {
  const ok = String(thuc) === String(mong);
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${ten}: ${thuc}${ok ? "" : ` (mong ${mong})`}`);
}
function kiemDung(ten, dieuKien, ghiChu = "") {
  if (!dieuKien) fail++;
  console.log(`${dieuKien ? "OK  " : "FAIL"} ${ten}${dieuKien ? "" : ` — ${ghiChu}`}`);
}

const browser = await chromium.launch({ executablePath: CHROME });
const loi = [];

/** Mã đơn giả lập, khác nhau mỗi lần chạy để test lặp lại được. */
const MA_TEST = `E2E${process.env.MA_TEST ?? Date.now().toString(36).toUpperCase()}`;

async function phien(email) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => loi.push(`[${email}] ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) loi.push(`[${email}] HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator(`form:has(button:has-text("${email}"))`).locator("button").click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  return { ctx, page };
}

/** Tên các mục menu đang hiện. */
async function menu(page) {
  return (await page.locator("header nav a").allTextContents()).map((t) => t.trim());
}

/** Số tiền lớn nhất đọc được trên trang, dùng để so doanh thu. */
function tienTuChuoi(s) {
  const m = String(s).replace(/\./g, "").match(/(\d+)\s*đ/);
  return m ? Number(m[1]) : null;
}

// ============================================================
console.log("\n=== 1. Chưa đăng nhập thì không vào được gì ===");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (const duong of ["/", "/orders", "/pos", "/inventory", "/customers", "/products"]) {
    await page.goto(`${BASE}${duong}`, { waitUntil: "networkidle" });
    kiem(`${duong} đẩy về /login`, new URL(page.url()).pathname, "/login");
  }

  const res = await page.request.get(`${BASE}/api/health`);
  kiem("API trả 401", res.status(), 401);
  await ctx.close();
}

// ============================================================
console.log("\n=== 2. Nhân viên bán lẻ Đồng Khởi ===");
let donCuaNhanVien = 0;
let khachCuaNhanVien = 0;
{
  const { ctx, page } = await phien("nv1.dk@aescentic.vn");
  kiem("vào thẳng trang chủ", new URL(page.url()).pathname, "/");

  const m = await menu(page);
  kiemDung("menu có Bán hàng", m.includes("Bán hàng"), m.join("/"));
  kiemDung("menu có Kho", m.includes("Kho"), m.join("/"));
  kiemDung("menu KHÔNG có Phân quyền", !m.includes("Phân quyền"), m.join("/"));
  kiemDung("menu KHÔNG có Người dùng", !m.includes("Người dùng"), m.join("/"));

  // Cửa hàng: chỉ thấy nơi mình được gán
  await page.goto(`${BASE}/stores`, { waitUntil: "networkidle" });
  kiem("chỉ thấy 1 cửa hàng", await page.locator("tbody tr").count(), 1);
  kiemDung(
    "đúng cửa hàng Đồng Khởi",
    (await page.locator("tbody tr").first().textContent()).includes("Đồng Khởi"),
  );

  // Đơn hàng: chỉ đơn mình bán (scope self)
  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
  donCuaNhanVien = await page.locator("tbody tr").count();
  kiemDung("đơn hàng bị giới hạn phạm vi", donCuaNhanVien < 160, `thấy ${donCuaNhanVien}/160`);

  // Kho: xem được nhưng không thấy giá vốn
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  const chuKho = await page.locator("main").textContent();
  kiemDung("xem được bảng tồn kho", (await page.locator("tbody tr").count()) > 0);
  kiemDung("KHÔNG thấy giá trị tồn kho", !chuKho.includes("Giá trị tồn kho"), "lộ giá vốn");

  // Sản phẩm: không có cột giá vốn
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const dauCot = (await page.locator("th").allTextContents()).join("|");
  kiemDung("bảng sản phẩm KHÔNG có cột giá vốn", !/giá vốn/i.test(dauCot), dauCot);

  // Khách hàng: chỉ khách đã mua ở cửa hàng mình
  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  khachCuaNhanVien = await page.locator("tbody tr").count();
  kiemDung("nhân viên thấy được khách của cửa hàng mình", khachCuaNhanVien > 0);

  // Trang quản trị: chặn thẳng
  await page.goto(`${BASE}/admin/roles`, { waitUntil: "networkidle" });
  kiem("vào /admin/roles bị đưa sang trang giải thích",
    new URL(page.url()).pathname, "/khong-du-quyen");
  kiemDung(
    "trang giải thích nói rõ thiếu quyền nào",
    (await page.locator("main").textContent()).includes("role.manage"),
  );

  const res = await page.request.get(`${BASE}/api/health`);
  kiem("API cần config.read trả 403", res.status(), 403);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/os-01-nhan-vien.png`, fullPage: true });
  await ctx.close();
}

// ============================================================
console.log("\n=== 3. Bán hàng thật ở POS ===");
{
  const { ctx, page } = await phien("ql.dk@aescentic.vn");

  // Tồn kho của SKU đầu tiên trước khi bán
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  const tongTruoc = Number(
    (await page.locator("main").textContent()).match(/([\d.]+)\s*sp/)?.[1]?.replace(/\./g, "") ?? -1,
  );
  kiemDung("đọc được tổng tồn trước khi bán", tongTruoc > 0, String(tongTruoc));

  await page.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  kiemDung("mở được màn bán hàng", (await page.locator("[data-sku]").count()) > 0);

  // Thêm sản phẩm đầu tiên vào giỏ
  const nutThem = page.locator('[data-sku]').first();
  const coNut = (await nutThem.count()) > 0;
  if (coNut) {
    await nutThem.click();
    await page.waitForTimeout(300);
    const gio = await page.locator("main").textContent();
    kiemDung("sản phẩm vào giỏ", /Tạm tính/i.test(gio), gio.slice(0, 120));

    // Đặt tên khách nhận biết được để dọn sạch sau khi test xong.
    await page.locator('input[name="tenKhach"]').fill(MA_TEST);

    const chot = page.locator("button", { hasText: /^Thanh toán$/ }).first();
    if ((await chot.count()) > 0) {
      await chot.click();
      await page.locator("[data-xong]").waitFor({ timeout: 20000 });
      const maDon = await page.locator("[data-xong]").getAttribute("data-xong");
      kiemDung("chốt đơn xong hiện mã đơn", /^[A-Z0-9-]+$/i.test(maDon ?? ""), String(maDon));

      // Mở đúng đơn vừa bán
      await page.locator('a:has-text("Xem đơn")').click();
      await page.waitForLoadState("networkidle");
      kiemDung(
        "mở được đơn vừa bán",
        (await page.locator("main").textContent()).includes(maDon),
        maDon,
      );

      await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
      const tongSau = Number(
        (await page.locator("main").textContent()).match(/([\d.]+)\s*sp/)?.[1]?.replace(/\./g, "") ?? -1,
      );
      kiemDung("bán xong tồn kho giảm", tongSau < tongTruoc, `${tongTruoc} → ${tongSau}`);
    } else {
      kiemDung("tìm thấy nút chốt đơn", false, "không có nút chốt");
    }
  } else {
    kiemDung("tìm thấy nút thêm sản phẩm", false, "không có [data-sku]");
  }

  await page.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/os-04-ban-hang.png`, fullPage: true });
  await ctx.close();
}

// ============================================================
console.log("\n=== 4. CEO thấy toàn bộ ===");
{
  const { ctx, page } = await phien("jen@aescentic.vn");

  const m = await menu(page);
  for (const muc of ["Tổng quan", "Bán hàng", "Đơn hàng", "Sản phẩm", "Kho", "Khách hàng", "Cửa hàng", "Người dùng", "Phân quyền"]) {
    kiemDung(`menu có ${muc}`, m.includes(muc), m.join("/"));
  }

  const trangChu = await page.locator("main").textContent();
  kiemDung("bảng điều khiển có doanh thu", /Doanh thu/.test(trangChu));
  kiemDung("CEO thấy lợi nhuận gộp", /Lợi nhuận gộp/.test(trangChu), "thiếu lợi nhuận");
  kiemDung(
    "có cảnh báo đang chạy POS giả lập",
    /giả lập/.test(trangChu),
    "phải nói rõ chưa nối Nhanh.vn",
  );
  await page.screenshot({ path: `${OUT}/os-02-tong-quan.png`, fullPage: true });

  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
  const tatCaDon = await page.locator("tbody tr").count();
  kiemDung("CEO thấy nhiều đơn hơn nhân viên", tatCaDon > donCuaNhanVien, `${tatCaDon} vs ${donCuaNhanVien}`);
  await page.screenshot({ path: `${OUT}/os-05-don-hang.png`, fullPage: true });

  // Tìm kiếm phải thu hẹp kết quả
  const maDon = (await page.locator("tbody tr td a").first().textContent()).trim();
  await page.goto(`${BASE}/orders?q=${encodeURIComponent(maDon)}`, { waitUntil: "networkidle" });
  kiem(`tìm theo mã đơn ${maDon} còn 1 dòng`, await page.locator("tbody tr").count(), 1);

  await page.goto(`${BASE}/orders?q=khong-ton-tai-xyz`, { waitUntil: "networkidle" });
  kiemDung(
    "tìm không ra thì báo rỗng tử tế",
    /Không có đơn nào/.test(await page.locator("main").textContent()),
  );

  // Lọc theo kênh
  await page.goto(`${BASE}/orders?kenh=shopee`, { waitUntil: "networkidle" });
  const dongShopee = await page.locator("tbody tr").count();
  const chuShopee = await page.locator("tbody").textContent();
  kiemDung("lọc kênh Shopee ra đúng kênh", dongShopee > 0 && !/TikTok Shop/.test(chuShopee), chuShopee.slice(0, 80));

  // Chi tiết đơn
  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
  await page.locator("tbody tr td a").first().click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  const ctDon = await page.locator("main").textContent();
  kiemDung("chi tiết đơn có bảng hàng", /Sản phẩm/.test(ctDon) && /Thành tiền/.test(ctDon), ctDon.slice(0, 100));
  kiemDung("chi tiết đơn có ít nhất 1 dòng hàng", (await page.locator("tbody tr").count()) > 0);
  kiemDung("CEO thấy lãi gộp của đơn", /Lãi gộp/.test(ctDon));
  await page.screenshot({ path: `${OUT}/os-06-chi-tiet-don.png`, fullPage: true });

  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  kiemDung("CEO thấy giá trị tồn kho", /Giá trị tồn kho/.test(await page.locator("main").textContent()));
  await page.screenshot({ path: `${OUT}/os-07-kho.png`, fullPage: true });

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  // So tương đối chứ không chốt con số: mỗi lần bán hàng hay nhập đơn đều sinh
  // thêm khách, một con số cứng sẽ đỏ vì dữ liệu lớn lên chứ không phải vì hỏng.
  const khachCuaCeo = await page.locator("tbody tr").count();
  kiemDung(
    "CEO thấy nhiều khách hơn nhân viên một cửa hàng",
    khachCuaCeo > khachCuaNhanVien,
    `${khachCuaCeo} vs ${khachCuaNhanVien}`,
  );
  await page.screenshot({ path: `${OUT}/os-08-khach-hang.png`, fullPage: true });

  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/os-09-san-pham.png`, fullPage: true });

  await page.goto(`${BASE}/stores`, { waitUntil: "networkidle" });
  kiem("thấy đủ 7 địa điểm", await page.locator("tbody tr").count(), 7);

  await page.goto(`${BASE}/admin/roles`, { waitUntil: "networkidle" });
  kiem("thấy 18 vai trò", await page.locator("tbody tr").count(), 18);
  await page.screenshot({ path: `${OUT}/os-03-phan-quyen.png`, fullPage: true });

  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  kiem("thấy 20 tài khoản", await page.locator("tbody tr").count(), 20);

  const res = await page.request.get(`${BASE}/api/health`);
  kiem("API health trả 200", res.status(), 200);
  kiem("báo đúng đang chạy POS giả lập", (await res.json()).integrations.pos.laMock, true);

  await ctx.close();
}

// ============================================================
console.log("\n=== 5. Kế toán: thấy tiền, không đụng kho ===");
{
  const { ctx, page } = await phien("ketoan@aescentic.vn");

  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  kiem("kế toán mở được màn kho", new URL(page.url()).pathname, "/inventory");
  kiemDung("kế toán xem được giá trị tồn kho", /Giá trị tồn kho/.test(await page.locator("main").textContent()));

  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const cotKeToan = (await page.locator("th").allTextContents()).join("|");
  kiemDung("bảng sản phẩm CÓ cột giá vốn cho kế toán", /giá vốn/i.test(cotKeToan), cotKeToan);

  const m = await menu(page);
  kiemDung("menu KHÔNG có Bán hàng", !m.includes("Bán hàng"), m.join("/"));

  await page.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  kiem("vào thẳng /pos vẫn bị chặn", new URL(page.url()).pathname, "/khong-du-quyen");
  await ctx.close();
}

// ============================================================
console.log("\n=== 6. Giao diện điện thoại ===");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => loi.push(`[mobile] ${e.message}`));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator(`form:has(button:has-text("jen@aescentic.vn"))`).locator("button").click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

  for (const duong of ["/", "/orders", "/inventory"]) {
    await page.goto(`${BASE}${duong}`, { waitUntil: "networkidle" });
    const tran = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    kiemDung(`${duong} không tràn ngang trên điện thoại`, tran <= 1, `tràn ${tran}px`);
  }
  await page.screenshot({ path: `${OUT}/os-10-dien-thoai.png`, fullPage: true });
  await ctx.close();
}


// ============================================================
console.log("\n=== 7. Nhập đơn từ file Shopee ===");
{
  const { ctx, page } = await phien("ql.dk@aescentic.vn");

  // File CSV giả lập bản xuất của Shopee, có dấu tiếng Việt và một SKU lạ.
  const csv =
    "Mã đơn hàng,Ngày đặt hàng,SKU phân loại hàng,Tên sản phẩm,Số lượng,Giá ưu đãi," +
    "Người nhận,Số điện thoại,Địa chỉ nhận hàng,Phí vận chuyển,Mã vận đơn,Trạng thái đơn hàng\n" +
    `${MA_TEST}-A,15/08/2026 10:30,AES-001-50,Amber Nuit 50ml,2,1.290.000,Nguyễn Thị Mai,+84901234567,"123 Lê Lợi, Q.1, TP.HCM",30.000,SPX001,Hoàn thành\n` +
    `${MA_TEST}-A,15/08/2026 10:30,AES-002-50,Amber Matin 50ml,1,1.290.000,Nguyễn Thị Mai,+84901234567,"123 Lê Lợi, Q.1, TP.HCM",30.000,SPX001,Hoàn thành\n` +
    `${MA_TEST}-B,16/08/2026 09:00,AES-001-50,Amber Nuit 50ml,1,1.290.000,Trần Minh Anh,0912345678,"45 Cầu Giấy, Hà Nội",0,SPX002,Đang giao\n` +
    `${MA_TEST}-C,16/08/2026 09:30,SKU-KHONG-CO,Hàng lạ,1,500.000,Lê Văn C,0987654321,"1 Bạch Đằng, Đà Nẵng",0,SPX003,Chờ lấy hàng\n`;

  await page.goto(`${BASE}/orders/nhap`, { waitUntil: "networkidle" });
  kiemDung("mở được màn nhập đơn", /Nhập đơn từ sàn/.test(await page.locator("main").textContent()));

  await page.locator('input[type="file"]').setInputFiles({
    name: "shopee-test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await page.locator("table").first().waitFor({ timeout: 20000 });

  const xemTruoc = await page.locator("main").textContent();
  kiemDung("tiêu đề tiếng Việt không bị vỡ mã", !/Ã|áº/.test(xemTruoc), "mojibake");
  kiemDung("gộp 2 dòng cùng mã đơn thành 1 đơn", /3 đơn/.test(xemTruoc), xemTruoc.slice(0, 160));
  kiemDung("2 đơn nhập được, 1 đơn SKU lạ bị chặn", /2 nhập được/.test(xemTruoc), xemTruoc.slice(0, 160));
  kiemDung("nói rõ SKU nào chưa có trong danh mục", /chưa có trong danh mục/.test(xemTruoc));
  kiemDung(
    'trạng thái "Hoàn thành" KHÔNG bị đọc thành hoàn hàng',
    !/Hoàn hàng/.test(xemTruoc),
    "đơn thành công bị nhập nhầm thành trả hàng",
  );
  await page.screenshot({ path: `${OUT}/os-11-nhap-don.png`, fullPage: true });

  await page.locator("button", { hasText: /^Nhập 2 đơn$/ }).click();
  await page.locator("text=Nhập xong").waitFor({ timeout: 30000 });
  const kq1 = await page.locator("main").textContent();
  kiemDung("nhập được 2 đơn mới", /2 đơn mới/.test(kq1), kq1.slice(0, 160));

  // Nhập lại đúng file đó: không được nhân đôi
  await page.locator('input[type="file"]').setInputFiles({
    name: "shopee-test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await page.locator("table").first().waitFor({ timeout: 20000 });
  await page.locator("button", { hasText: /^Nhập 2 đơn$/ }).click();
  await page.locator("text=Nhập xong").waitFor({ timeout: 30000 });
  const kq2 = await page.locator("main").textContent();
  kiemDung("nhập lại cùng file KHÔNG nhân đôi đơn", /0 đơn mới/.test(kq2), kq2.slice(0, 200));
  kiemDung("báo rõ đã bỏ qua đơn cũ", /bỏ qua/.test(kq2), kq2.slice(0, 200));

  // Đơn đã vào danh sách và tìm được
  await page.goto(`${BASE}/orders?q=${MA_TEST}-A`, { waitUntil: "networkidle" });
  kiem("tìm thấy đơn vừa nhập", await page.locator("tbody tr").count(), 1);
  const dong = await page.locator("tbody tr").first().textContent();
  kiemDung("đơn ghi đúng khách hàng", /Nguyễn Thị Mai/.test(dong), dong);
  kiemDung("đơn ghi đúng kênh Shopee", /Shopee/.test(dong), dong);

  await ctx.close();
}

await browser.close();

console.log("\n=== Lỗi console / HTTP 5xx ===");
if (loi.length) [...new Set(loi)].forEach((l) => console.log("  " + l));
else console.log("  không có");
if (loi.length) fail += loi.length;

console.log(fail === 0 ? "\n✅ TẤT CẢ PASS" : `\n❌ ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
