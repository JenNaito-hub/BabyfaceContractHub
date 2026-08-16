/**
 * Xoá dữ liệu do `e2e.mjs` tạo ra.
 *
 * Bộ kiểm thử đầu-cuối bán hàng thật, nhập kho thật, chuyển kho thật — đúng như
 * vậy mới kiểm được. Nhưng chạy vài lần là database demo đầy chứng từ rác và
 * con số trên màn hình thành vô nghĩa. Script này dọn sạch phần đó và CHỈ phần
 * đó.
 *
 * Cách hoàn kho, hai bước:
 *   1. Đổi trạng thái chứng từ để CHÍNH TRIGGER hoàn kho — đúng con đường mà
 *      app dùng hằng ngày, nên chắc chắn khớp.
 *   2. Phần trigger không lo được (phiếu chuyển đã nhận thì không có đường quay
 *      lui) thì đọc SỔ KHO xem còn lệch bao nhiêu rồi bù đúng chừng ấy.
 *
 * Làm ngược lại — bù theo sổ kho trước rồi mới đổi trạng thái — là trừ kho hai
 * lần, và mỗi lần chạy e2e tổng tồn kho lại hụt đi một ít.
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

// ============================================================
// Đơn hàng: đơn nhập từ sàn có external_ref "<kênh>:E2E…", đơn bán ở POS có
// tên khách là mã E2E. Hai mẫu này chỉ do e2e sinh ra.
// ============================================================
const dons = await sql`
  select id from os.orders
  where external_ref like '%:E2E%' or customer_name like 'E2E%'`;

for (const don of dons) {
  // 'cancelled' để trigger hoàn kho, rồi mới xoá
  await sql`update os.orders set status = 'cancelled' where id = ${don.id}`;
  await sql`delete from os.order_lines where order_id = ${don.id}`;
  await sql`delete from os.orders where id = ${don.id}`;
}

// ============================================================
// Phiếu nhập / phiếu chuyển: nhận biết bằng ghi chú.
// ============================================================
const nhap = await sql`select id from os.stock_receipts where note like 'E2E%'`;
const chuyen = await sql`select id from os.stock_transfers where note like 'E2E%'`;
const idChungTu = [...nhap, ...chuyen].map((r) => r.id);

if (idChungTu.length) {
  // Bước 1: đổi trạng thái để chính trigger hoàn kho — đây là đường mà app
  // dùng, nên nó chắc chắn đúng. Phiếu nhập completed→draft thì trigger trừ
  // lại; phiếu chuyển đang đi thì huỷ là hàng về kho gửi.
  for (const r of nhap) {
    await sql`update os.stock_receipts set status = 'draft'
              where id = ${r.id} and status = 'completed'`;
  }
  for (const r of chuyen) {
    await sql`update os.stock_transfers set status = 'cancelled'
              where id = ${r.id} and status = 'in_transit'`;
  }

  // Bước 2: phần trigger không lo được — phiếu chuyển đã 'received' thì không
  // có đường quay lui. Đọc SỔ KHO xem còn lệch bao nhiêu rồi bù đúng chừng ấy.
  // Chứng từ nào đã hoàn ở bước 1 sẽ nét bằng 0 nên không bị trừ hai lần.
  const net = await sql`
    select sku_id, location_id, sum(delta)::int as tong
    from os.inventory_transactions
    where ref_id = any(${idChungTu})
    group by sku_id, location_id
    having sum(delta) <> 0`;

  for (const r of net) {
    await sql`select os.fn_apply_stock_move(
      ${r.sku_id}::uuid, ${r.location_id}::uuid, ${-r.tong},
      'stock_count', 'e2e', null, 'Hoàn tác chứng từ e2e')`;
  }

  // Bước 3: về 'draft' mới xoá được dòng hàng. Kho đã cân nên đổi trạng thái
  // lúc này không làm tồn kho đổi thêm.
  for (const r of chuyen) {
    await sql`update os.stock_transfers set status = 'draft' where id = ${r.id}`;
    await sql`delete from os.transfer_lines where transfer_id = ${r.id}`;
    await sql`delete from os.stock_transfers where id = ${r.id}`;
  }
  for (const r of nhap) {
    await sql`update os.stock_receipts set status = 'draft' where id = ${r.id}`;
    await sql`delete from os.receipt_lines where receipt_id = ${r.id}`;
    await sql`delete from os.stock_receipts where id = ${r.id}`;
  }
}

// Khách hàng do e2e sinh ra mà không còn đơn nào
const khach = await sql`
  delete from os.customers c
  where c.full_name like 'E2E%'
    and not exists (select 1 from os.orders o where o.customer_id = c.id)
  returning c.id`;

const [amDuong] = await sql`
  select count(*)::int as n from os.inventory_balances where quantity < 0`;

// Số dư phải luôn khớp tổng sổ kho — nếu lệch thì chính script này đã sai.
const [lech] = await sql`
  select count(*)::int as n from (
    select b.sku_id, b.location_id
    from os.inventory_balances b
    left join os.inventory_transactions t
      on t.sku_id = b.sku_id and t.location_id = b.location_id
    group by b.sku_id, b.location_id, b.quantity
    having b.quantity <> coalesce(sum(t.delta), 0)
  ) x`;

await sql.end();

console.log(
  `Đã xoá ${dons.length} đơn, ${nhap.length} phiếu nhập, ${chuyen.length} phiếu chuyển, ` +
    `${khach.length} khách — tất cả do e2e tạo.`,
);

if (amDuong.n > 0 || lech.n > 0) {
  console.error(
    `CẢNH BÁO: ${amDuong.n} dòng tồn kho âm, ${lech.n} dòng lệch so với sổ kho sau khi dọn.`,
  );
  process.exit(1);
}
