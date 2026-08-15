import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.env.OUT_DIR || "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:3000";

const TAI_KHOAN = {
  admin: "jen@aescentic.vn",
  staff: "nhanvien@aescentic.vn",
};

async function dangNhap(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

const TRANG = [
  ["01-hub", "/", 1400],
  ["02-tong-quan", "/sales", 2500],
  ["03-pos", "/sales/pos", 1800],
  ["04-don-hang", "/sales/orders", 2000],
  ["05-san-pham", "/sales/products", 1800],
  ["06-kho", "/sales/inventory", 2000],
  ["07-khach-hang", "/sales/customers", 1800],
  ["08-bao-cao", "/sales/reports", 2500],
  ["09-doi-soat-cod", "/sales/orders/cod", 1800],
  ["10-nhap-file-san", "/sales/orders/import", 1500],
  ["11-nhap-kho", "/sales/inventory/receipts", 1500],
  ["12-chuyen-kho", "/sales/inventory/transfers", 1500],
  ["13-cai-dat", "/sales/settings", 1500],
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const loi = [];

// ---- Ảnh với quyền admin ----
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => loi.push(`pageerror: ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("favicon")) loi.push(`HTTP ${r.status()} ${r.url()}`);
});

await dangNhap(page, TAI_KHOAN.admin);

for (const [ten, duongDan, cho] of TRANG) {
  await page.goto(BASE + duongDan, { waitUntil: "networkidle" });
  await page.waitForTimeout(cho);
  await page.screenshot({ path: `${OUT}/${ten}.png`, fullPage: true });
  console.log(`✓ ${ten}`);
}

// Chi tiết 1 đơn
await page.goto(`${BASE}/sales/orders`, { waitUntil: "networkidle" });
const link = page.locator('a[href^="/sales/orders/"]').first();
const href = await link.getAttribute("href");
await page.goto(BASE + href, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/14-chi-tiet-don.png`, fullPage: true });
console.log("✓ 14-chi-tiet-don");

// Phiếu giao hàng (chặn window.print để không treo)
const idDon = href.split("/").pop();
const p2 = await ctx.newPage();
await p2.addInitScript(() => { window.print = () => {}; });
await p2.goto(`${BASE}/print/orders?ids=${idDon}&kieu=phieu`, { waitUntil: "networkidle" });
await p2.waitForTimeout(1200);
await p2.screenshot({ path: `${OUT}/15-phieu-giao.png`, fullPage: true });
await p2.goto(`${BASE}/print/orders?ids=${idDon}&kieu=hoadon`, { waitUntil: "networkidle" });
await p2.waitForTimeout(1000);
await p2.screenshot({ path: `${OUT}/16-hoa-don.png`, fullPage: true });
console.log("✓ 15/16 phiếu in");
await p2.close();

// ---- Ảnh với quyền nhân viên: giá vốn phải biến mất ----
await ctx.close();
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const p3 = await ctx2.newPage();
p3.on("pageerror", (e) => loi.push(`[staff] pageerror: ${e.message}`));
await dangNhap(p3, TAI_KHOAN.staff);
await p3.goto(`${BASE}/sales`, { waitUntil: "networkidle" });
await p3.waitForTimeout(2500);
await p3.screenshot({ path: `${OUT}/17-tong-quan-nhan-vien.png`, fullPage: true });
await p3.goto(`${BASE}/sales/products`, { waitUntil: "networkidle" });
await p3.waitForTimeout(1500);
await p3.screenshot({ path: `${OUT}/18-san-pham-nhan-vien.png`, fullPage: true });
console.log("✓ 17/18 góc nhìn nhân viên");

// Điện thoại — POS
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const p4 = await ctx3.newPage();
await dangNhap(p4, TAI_KHOAN.staff);
await p4.goto(`${BASE}/sales/pos`, { waitUntil: "networkidle" });
await p4.waitForTimeout(1500);
await p4.screenshot({ path: `${OUT}/19-pos-dien-thoai.png`, fullPage: true });
console.log("✓ 19-pos-dien-thoai");

await browser.close();

if (loi.length) {
  console.log("\n⚠ LỖI PHÁT HIỆN:");
  [...new Set(loi)].slice(0, 30).forEach((l) => console.log("  " + l));
  process.exit(1);
}
console.log("\nKhông có lỗi console/HTTP nào.");
