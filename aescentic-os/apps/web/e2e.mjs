/**
 * Kiểm thử đầu-cuối Phase 0: đăng nhập chạy thật và phân quyền áp đúng ở UI.
 *
 * Cần app đang chạy ở cổng 3100 với ALLOW_DEV_LOGIN=true.
 *   node apps/web/e2e.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const CHROME =
  process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let fail = 0;
function kiem(ten, thuc, mong) {
  const ok = String(thuc) === String(mong);
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${ten}: ${thuc}${ok ? "" : ` (mong ${mong})`}`);
}

const browser = await chromium.launch({ executablePath: CHROME });
const loi = [];

/**
 * Đọc ô "kết quả" của một dòng quyền.
 * Không dùng `text=Được` dò cả dòng: cột phạm vi có chuỗi "cửa hàng được gán"
 * và Playwright khớp không phân biệt hoa thường nên sẽ dính nhầm.
 */
async function ketQuaQuyen(page, quyen) {
  const o = page
    .locator("table")
    .first()
    .locator("tr", { hasText: quyen })
    .locator("span.pill");
  return (await o.first().textContent())?.trim();
}

async function phien(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

console.log("\n=== 1. Chưa đăng nhập thì bị chặn ===");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  kiem("vào / bị đẩy về /login", new URL(page.url()).pathname, "/login");

  const res = await page.request.get(`${BASE}/api/health`);
  kiem("API trả 401", res.status(), 401);
  await ctx.close();
}

console.log("\n=== 2. Nhân viên bán lẻ ===");
{
  const { ctx, page } = await phien("nv1.dk@aescentic.vn");
  kiem("đăng nhập vào được trang chủ", new URL(page.url()).pathname, "/");

  kiem("không được xem giá vốn", await ketQuaQuyen(page, "product.cost"), "Không");
  kiem("không được duyệt lương", await ketQuaQuyen(page, "payroll.approve"), "Không");

  kiem("menu không có Phân quyền", await page.locator('nav a:has-text("Phân quyền")').count(), 0);

  // Cửa hàng: chỉ thấy cửa hàng được gán
  await page.goto(`${BASE}/stores`, { waitUntil: "networkidle" });
  const soDong = await page.locator("tbody tr").count();
  kiem("chỉ thấy 1 cửa hàng được gán", soDong, 1);
  kiem(
    "đúng là cửa hàng Đồng Khởi",
    await page.locator("tbody tr").first().textContent().then((t) => t.includes("Đồng Khởi")),
    true,
  );

  // API vượt quyền phải bị chặn
  const res = await page.request.get(`${BASE}/api/health`);
  kiem("API cần config.read trả 403", res.status(), 403);

  await page.screenshot({ path: `${process.env.OUT_DIR}/os-01-nhan-vien.png`, fullPage: true });
  await ctx.close();
}

console.log("\n=== 3. Quản lý cửa hàng ===");
{
  const { ctx, page } = await phien("ql.dk@aescentic.vn");
  kiem("được điều chỉnh tồn kho", await ketQuaQuyen(page, "inventory.adjust"), "Được");
  const dongKho = page.locator("table").first().locator("tr", { hasText: "inventory.adjust" });
  kiem(
    "phạm vi là cửa hàng được gán",
    await dongKho.textContent().then((t) => t.includes("cửa hàng được gán")),
    true,
  );
  await ctx.close();
}

console.log("\n=== 4. CEO ===");
{
  const { ctx, page } = await phien("jen@aescentic.vn");
  const bang = page.locator("table").first();
  kiem(
    "không có dòng nào bị từ chối",
    await bang.locator("tbody span.pill", { hasText: /^Không$/ }).count(),
    0,
  );
  kiem("menu có Phân quyền", await page.locator('nav a:has-text("Phân quyền")').count(), 1);

  await page.goto(`${BASE}/stores`, { waitUntil: "networkidle" });
  kiem("thấy đủ 7 địa điểm", await page.locator("tbody tr").count(), 7);
  await page.screenshot({ path: `${process.env.OUT_DIR}/os-02-ceo.png`, fullPage: true });

  await page.goto(`${BASE}/admin/roles`, { waitUntil: "networkidle" });
  kiem("thấy 18 vai trò", await page.locator("tbody tr").count(), 18);
  await page.screenshot({ path: `${process.env.OUT_DIR}/os-03-phan-quyen.png`, fullPage: true });

  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  kiem("thấy 20 tài khoản", await page.locator("tbody tr").count(), 20);

  const res = await page.request.get(`${BASE}/api/health`);
  kiem("API health trả 200", res.status(), 200);
  const body = await res.json();
  kiem("báo đúng đang chạy POS giả lập", body.integrations.pos.laMock, true);

  await ctx.close();
}

console.log("\n=== 5. Kế toán ===");
{
  const { ctx, page } = await phien("ketoan@aescentic.vn");
  kiem("được xem giá vốn", await ketQuaQuyen(page, "product.cost"), "Được");
  kiem("không được điều chỉnh tồn kho", await ketQuaQuyen(page, "inventory.adjust"), "Không");
  await ctx.close();
}

await browser.close();

console.log("\n=== Lỗi console / HTTP 5xx ===");
if (loi.length) [...new Set(loi)].forEach((l) => console.log("  " + l));
else console.log("  không có");

console.log(fail === 0 ? "\n✅ TẤT CẢ PASS" : `\n❌ ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
