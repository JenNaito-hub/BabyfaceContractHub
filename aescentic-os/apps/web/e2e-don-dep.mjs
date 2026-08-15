/**
 * Xoá dữ liệu do `e2e.mjs` tạo ra.
 *
 * Bộ kiểm thử đầu-cuối bán hàng thật và nhập đơn thật — đúng như vậy mới kiểm
 * được. Nhưng chạy vài lần là database demo đầy đơn rác và con số trên màn hình
 * thành vô nghĩa. Script này dọn sạch phần đó và CHỈ phần đó.
 *
 * Đơn được đưa về 'cancelled' trước khi xoá để trigger hoàn kho — xoá thẳng thì
 * tồn kho lệch vĩnh viễn.
 *
 *   DATABASE_URL=... node apps/web/e2e-don-dep.mjs
 */
import postgres from "postgres";

const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error("Thiếu DATABASE_URL");
  process.exit(1);
}

const sql = postgres(URL, { max: 1 });

// Đơn nhập từ sàn: external_ref dạng "<kênh>:E2E...". Đơn bán ở POS: tên khách
// là mã E2E. Hai mẫu này chỉ do e2e sinh ra, không đụng dữ liệu mẫu hay dữ liệu thật.
const dieuKien = sql`external_ref like '%:E2E%' or customer_name like 'E2E%'`;

const dons = await sql`select id, code from os.orders where ${dieuKien}`;

for (const don of dons) {
  // Hoàn kho trước
  await sql`update os.orders set status = 'cancelled' where id = ${don.id}`;
  await sql`delete from os.order_lines where order_id = ${don.id}`;
  await sql`delete from os.orders where id = ${don.id}`;
}

// Khách hàng do e2e sinh ra mà không còn đơn nào
const khach = await sql`
  delete from os.customers c
  where c.full_name like 'E2E%'
    and not exists (select 1 from os.orders o where o.customer_id = c.id)
  returning c.id`;

const [conLai] = await sql`
  select count(*)::int as n from os.inventory_balances where quantity < 0`;

await sql.end();

console.log(`Đã xoá ${dons.length} đơn e2e, ${khach.length} khách e2e.`);
if (conLai.n > 0) {
  console.error(`CẢNH BÁO: còn ${conLai.n} dòng tồn kho âm sau khi dọn.`);
  process.exit(1);
}
