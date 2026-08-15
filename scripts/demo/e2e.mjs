import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const BASE = "http://127.0.0.1:3000";
const FILES = process.env.FILES_DIR;
const OUT = process.env.OUT_DIR;

const sql = (q) =>
  execFileSync("psql", ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-d", "demo", "-t", "-A", "-c", q])
    .toString()
    .trim();

let fail = 0;
function kiem(ten, thuc, mong) {
  const ok = String(thuc) === String(mong);
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${ten}: ${thuc}${ok ? "" : ` (mong ${mong})`}`);
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const loi = [];
page.on("pageerror", (e) => loi.push("pageerror: " + e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("favicon")) loi.push(`HTTP ${r.status()} ${r.url()}`);
});

async function dangNhap(email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"));
  await page.waitForLoadState("networkidle");
}

// ============ 1. BÁN HÀNG TẠI QUẦY ============
console.log("\n=== 1. POS: bán 2 chai tại cửa hàng ===");
await dangNhap("nhanvien@aescentic.vn");

const tonTruoc = Number(
  sql(`select so_luong from inventory i join stores s on s.id=i.store_id
       join variants v on v.id=i.variant_id where v.sku='AMB-50' and s.ma='S1'`),
);
const donTruoc = Number(sql("select count(*) from orders"));

await page.goto(`${BASE}/sales/pos`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
// Quét mã vạch: gõ SKU rồi Enter
await page.fill('input[placeholder*="quét mã vạch"]', "AMB-50");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
// Máy quét thật gửi lại toàn bộ mã mỗi lần quét → mô phỏng đúng như vậy
await page.fill('input[placeholder*="quét mã vạch"]', "AMB-50");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
await page.fill('input[placeholder*="09xx"]', "0912345678");
await page.fill('input[placeholder*="Tên khách"]', "Khách Test POS");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/21-pos-co-hang.png`, fullPage: true });

await page.click('button:has-text("Thanh toán")');
await page.waitForSelector("text=Đã tạo đơn", { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/22-pos-thanh-toan-xong.png`, fullPage: true });

kiem("số đơn tăng 1", sql("select count(*) from orders"), donTruoc + 1);
kiem(
  "tồn AMB-50 tại S1 giảm 2",
  sql(`select so_luong from inventory i join stores s on s.id=i.store_id
       join variants v on v.id=i.variant_id where v.sku='AMB-50' and s.ma='S1'`),
  tonTruoc - 2,
);
kiem(
  "sổ kho ghi đúng 1 dòng bán cho đơn vừa tạo",
  sql(`select count(*) from stock_moves m
       join orders o on o.id = m.ref_id
       where m.loai='ban' and m.ref_type='order' and o.khach_sdt='0912345678'`),
  1,
);
kiem(
  "dòng sổ kho đúng -2 chai",
  sql(`select m.delta from stock_moves m join orders o on o.id = m.ref_id
       where m.loai='ban' and o.khach_sdt='0912345678'`),
  -2,
);
kiem("khách mới được tạo", sql("select ho_ten from customers where sdt='0912345678'"), "Khách Test POS");

// ============ 2. NHÂN VIÊN KHÔNG THẤY GIÁ VỐN ============
console.log("\n=== 2. Phân quyền ===");
await page.goto(`${BASE}/sales/products`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
kiem("staff không thấy cột Giá vốn", await page.locator("th:has-text('Giá vốn')").count(), 0);
kiem("staff không thấy tab Báo cáo", await page.locator("nav a:has-text('Báo cáo')").count(), 0);
await page.goto(`${BASE}/sales/reports`, { waitUntil: "networkidle" });
kiem("staff vào /sales/reports bị đá về", new URL(page.url()).pathname, "/sales");

// ============ 3. IMPORT ĐƠN SHOPEE ============
console.log("\n=== 3. Import file Shopee ===");
await dangNhap("jen@aescentic.vn");
await page.goto(`${BASE}/sales/orders/import`, { waitUntil: "networkidle" });
await page.setInputFiles('input[type="file"]', `${FILES}/shopee.csv`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/23-import-xem-truoc.png`, fullPage: true });

const nutImport = page.locator('button:has-text("Import")').first();
kiem("nhận đúng 3 đơn sẵn sàng", (await nutImport.textContent())?.includes("3 đơn"), true);
await nutImport.click();
await page.waitForSelector("text=Đã import", { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/24-import-xong.png`, fullPage: true });

kiem("3 đơn Shopee vào hệ thống", sql("select count(*) from orders where ma_don_san like 'SPE-TEST%'"), 3);
kiem(
  "đơn import không trừ kho",
  sql("select count(*) from orders where ma_don_san like 'SPE-TEST%' and da_tru_kho = false"),
  3,
);
kiem(
  "khớp đúng SKU và số lượng",
  sql(`select sum(oi.so_luong) from order_items oi join orders o on o.id=oi.order_id
       where o.ma_don_san like 'SPE-TEST%' and oi.variant_id is not null`),
  6,
);

// import lại chính file đó → phải nhận ra trùng
await page.goto(`${BASE}/sales/orders/import`, { waitUntil: "networkidle" });
await page.setInputFiles('input[type="file"]', `${FILES}/shopee.csv`);
await page.waitForTimeout(2000);
kiem("import lại: 0 đơn mới", await page.locator('button:has-text("Import 0 đơn")').count(), 1);
kiem("vẫn chỉ có 3 đơn", sql("select count(*) from orders where ma_don_san like 'SPE-TEST%'"), 3);

// ============ 4. ĐỐI SOÁT COD ============
console.log("\n=== 4. Đối soát COD ===");
await page.goto(`${BASE}/sales/orders/cod`, { waitUntil: "networkidle" });
await page.setInputFiles('input[type="file"]', `${FILES}/doi-soat.csv`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/25-doi-soat-xem-truoc.png`, fullPage: true });

kiem("phát hiện 1 mã vận đơn lạ", await page.locator("td:has-text('Không thấy đơn')").count(), 1);
const soLech = await page.locator("td span:has-text('Lệch tiền')").count();
console.log(`     (số dòng lệch tiền: ${soLech})`);

const nutGhi = page.locator('button:has-text("Ghi nhận")').first();
const nhan = await nutGhi.textContent();
await nutGhi.click();
await page.waitForSelector("text=Đã ghi nhận", { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/26-doi-soat-xong.png`, fullPage: true });

kiem(
  "đơn đã đối soát được đánh dấu",
  sql("select count(*) from orders where ngay_doi_soat = current_date and cod_da_thu is not null"),
  Number(nhan.match(/(\d+) đơn/)?.[1] ?? 0),
);
kiem(
  "đơn đối soát xong đều đã thanh toán",
  sql("select count(*) from orders where ngay_doi_soat = current_date and thanh_toan <> 'da_thanh_toan'"),
  0,
);

// ============ 5. ĐỔI TRẠNG THÁI HÀNG LOẠT ============
console.log("\n=== 5. Đổi trạng thái hàng loạt ===");
await page.goto(`${BASE}/sales/orders`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.selectOption('select:near(:text("Mọi trạng thái"))', "moi").catch(() => {});
await page.waitForTimeout(800);
await page.locator('thead input[type="checkbox"]').check();
await page.waitForTimeout(500);
const soChon = Number((await page.locator("text=/Đã chọn \\d+ đơn/").textContent()).match(/\d+/)[0]);
await page.screenshot({ path: `${OUT}/27-chon-nhieu-don.png`, fullPage: true });
console.log(`     chọn ${soChon} đơn`);

await page.selectOption('select:has(option:text("Chuyển trạng thái…"))', "da_xac_nhan");
await page.waitForSelector("text=/Đã đổi \\d+/", { timeout: 30000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/28-doi-hang-loat-xong.png`, fullPage: true });
const thongBao = await page.locator("text=/Đã đổi \\d+/").textContent();
console.log(`     ${thongBao.trim()}`);

await browser.close();

console.log("\n=== LỖI CONSOLE / HTTP ===");
if (loi.length) [...new Set(loi)].forEach((l) => console.log("  " + l));
else console.log("  không có");

console.log(fail === 0 ? "\n✅ TẤT CẢ KIỂM TRA PASS" : `\n❌ ${fail} KIỂM TRA FAIL`);
process.exit(fail === 0 ? 0 : 1);
