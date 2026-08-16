/**
 * Gom số liệu cho báo cáo xuất Excel.
 *
 * Mọi truy vấn ở đây đi qua `danhSachDon` hoặc tự áp bộ lọc phạm vi — xuất
 * Excel không được là đường vòng để lấy dữ liệu ngoài quyền của mình.
 */
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { orderLineCosts, orderLines, orders, skus, stores } from "@aescentic/database";
import { authorize, boLocRong, requirePermission } from "@aescentic/permissions";
import type { Ctx } from "./index.ts";
import { NHAN_KENH, NHAN_THANH_TOAN, NHAN_TRANG_THAI, type TrangThaiDon } from "./labels.ts";

export type KyBaoCao = { tuNgay: Date; denNgay: Date };

function ngayVN(d: Date | string): string {
  const x = new Date(d);
  return (
    x.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    x.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Danh sách đơn trong kỳ, mỗi đơn một dòng. */
export async function baoCaoDon(ctx: Ctx, ky: KyBaoCao) {
  const d = requirePermission(ctx.principal, "order.read");
  if (boLocRong(d.filter)) return [];

  const dieuKien = [gte(orders.placedAt, ky.tuNgay), lt(orders.placedAt, ky.denNgay)];
  if (d.filter.kind === "stores") dieuKien.push(inArray(orders.storeId, d.filter.storeIds));
  if (d.filter.kind === "self") dieuKien.push(eq(orders.soldBy, ctx.principal.userId));

  const ds = await ctx.db
    .select({
      code: orders.code,
      placedAt: orders.placedAt,
      channel: orders.channel,
      storeName: stores.name,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      province: orders.province,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      subtotal: orders.subtotal,
      discount: orders.discount,
      shippingFee: orders.shippingFee,
      total: orders.total,
      carrier: orders.carrier,
      trackingCode: orders.trackingCode,
      externalRef: orders.externalRef,
    })
    .from(orders)
    .leftJoin(stores, eq(stores.id, orders.storeId))
    .where(and(...dieuKien))
    .orderBy(desc(orders.placedAt))
    .limit(50_000);

  return ds.map((o) => ({
    code: o.code,
    ngay: ngayVN(o.placedAt),
    kenh: NHAN_KENH[o.channel] ?? o.channel,
    cuaHang: o.storeName ?? "",
    khach: o.customerName ?? "",
    sdt: o.customerPhone ?? "",
    tinh: o.province ?? "",
    trangThai: NHAN_TRANG_THAI[o.status as TrangThaiDon] ?? o.status,
    thanhToan: NHAN_THANH_TOAN[o.paymentStatus] ?? o.paymentStatus,
    tienHang: Number(o.subtotal),
    giamGia: Number(o.discount),
    phiShip: Number(o.shippingFee),
    tongTien: Number(o.total),
    hangVanChuyen: o.carrier ?? "",
    maVanDon: o.trackingCode ?? "",
    maSan: o.externalRef ?? "",
  }));
}

/** Bán ra theo từng SKU: số lượng, doanh thu, và lãi gộp nếu có quyền. */
export async function baoCaoSanPham(ctx: Ctx, ky: KyBaoCao) {
  const d = requirePermission(ctx.principal, "order.read");
  if (boLocRong(d.filter)) return [];
  const xemVon = authorize(ctx.principal, "product.cost").allowed;

  const dieuKien = [
    gte(orders.placedAt, ky.tuNgay),
    lt(orders.placedAt, ky.denNgay),
    eq(orders.status, "completed"),
  ];
  if (d.filter.kind === "stores") dieuKien.push(inArray(orders.storeId, d.filter.storeIds));
  if (d.filter.kind === "self") dieuKien.push(eq(orders.soldBy, ctx.principal.userId));

  const ds = await ctx.db
    .select({
      skuCode: orderLines.skuCode,
      ten: sql<string>`max(coalesce(${orderLines.displayName}, ${skus.name}, ''))`,
      soLuong: sql<number>`sum(${orderLines.quantity})::int`,
      doanhThu: sql<number>`sum(${orderLines.quantity} * ${orderLines.unitPrice} - ${orderLines.discount})::bigint`,
      giaVon: sql<number>`coalesce(sum(${orderLines.quantity} * coalesce(${orderLineCosts.unitCost}, 0)), 0)::bigint`,
      soDon: sql<number>`count(distinct ${orders.id})::int`,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .leftJoin(skus, eq(skus.id, orderLines.skuId))
    .leftJoin(orderLineCosts, eq(orderLineCosts.orderLineId, orderLines.id))
    .where(and(...dieuKien))
    .groupBy(orderLines.skuCode)
    .orderBy(desc(sql`sum(${orderLines.quantity} * ${orderLines.unitPrice} - ${orderLines.discount})`))
    .limit(5000);

  return ds.map((r) => {
    const doanhThu = Number(r.doanhThu);
    const von = Number(r.giaVon);
    return {
      sku: r.skuCode ?? "",
      ten: r.ten,
      soDon: r.soDon,
      soLuong: r.soLuong,
      doanhThu,
      ...(xemVon
        ? {
            giaVon: von,
            laiGop: doanhThu - von,
            bienLai: doanhThu ? Math.round(((doanhThu - von) / doanhThu) * 100) : 0,
          }
        : {}),
    };
  });
}

/** Doanh thu từng ngày trong kỳ, kể cả ngày không bán được gì. */
export async function baoCaoTheoNgay(ctx: Ctx, ky: KyBaoCao) {
  const ds = await baoCaoDon(ctx, ky);
  const theoNgay = new Map<string, { soDon: number; doanhThu: number }>();

  for (const o of ds) {
    if (o.trangThai !== NHAN_TRANG_THAI.completed) continue;
    // `ngay` đang là "dd/mm/yyyy hh:mm" — cắt lấy phần ngày
    const k = o.ngay.slice(0, 10);
    const cur = theoNgay.get(k) ?? { soDon: 0, doanhThu: 0 };
    cur.soDon++;
    cur.doanhThu += o.tongTien;
    theoNgay.set(k, cur);
  }

  const out: { ngay: string; soDon: number; doanhThu: number }[] = [];
  for (const d = new Date(ky.tuNgay); d < ky.denNgay; d.setDate(d.getDate() + 1)) {
    const k = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const v = theoNgay.get(k) ?? { soDon: 0, doanhThu: 0 };
    out.push({ ngay: k, ...v });
  }
  return out;
}
