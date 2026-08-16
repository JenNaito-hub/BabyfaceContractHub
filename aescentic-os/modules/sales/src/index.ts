import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  codBatchLines,
  codBatches,
  ghiAudit,
  inventoryLocations,
  orderLineCosts,
  orderLines,
  orders,
  skus,
  stores,
  trongGiaoDich,
  type Db,
} from "@aescentic/database";
import {
  authorize,
  boLocRong,
  canTouchStore,
  requirePermission,
  type Principal,
} from "@aescentic/permissions";
import { phatSuKien } from "@aescentic/events";
import {
  CHUYEN_TRANG_THAI,
  NHAN_TRANG_THAI,
  TINH_DOANH_THU,
  type TrangThaiDon,
} from "./labels.ts";

/** Ngữ cảnh gọi service: ai đang thao tác, trên kết nối nào. */
export type Ctx = { db: Db; principal: Principal };

// Nhãn và hằng số nằm ở `labels.ts` để giao diện client import được mà không
// kéo theo database. Re-export ở đây cho code phía server dùng một chỗ.
export * from "./labels.ts";
export * from "./bao-cao.ts";

// ============================================================
// Đọc
// ============================================================

export type BoLocDon = {
  tuNgay?: Date;
  denNgay?: Date;
  trangThai?: TrangThaiDon;
  kenh?: string;
  /** Tìm theo mã đơn, tên/điện thoại khách, mã vận đơn hoặc mã đơn bên sàn. */
  tuKhoa?: string;
  gioiHan?: number;
};

/**
 * Danh sách đơn, ĐÃ áp bộ lọc phạm vi của người gọi.
 * Không có overload nào bỏ qua bộ lọc — đó là chủ ý.
 */
export async function danhSachDon(ctx: Ctx, bl: BoLocDon = {}) {
  const d = requirePermission(ctx.principal, "order.read");
  if (boLocRong(d.filter)) return [];

  const dieuKien = [];
  if (d.filter.kind === "stores") dieuKien.push(inArray(orders.storeId, d.filter.storeIds));
  if (d.filter.kind === "self") dieuKien.push(eq(orders.soldBy, ctx.principal.userId));
  if (bl.tuNgay) dieuKien.push(gte(orders.placedAt, bl.tuNgay));
  if (bl.denNgay) dieuKien.push(lt(orders.placedAt, bl.denNgay));
  if (bl.trangThai) dieuKien.push(eq(orders.status, bl.trangThai));
  if (bl.kenh) dieuKien.push(eq(orders.channel, bl.kenh));

  const tuKhoa = bl.tuKhoa?.trim();
  if (tuKhoa) {
    // `ilike` để không phân biệt hoa thường và dấu cách khi Jen gõ nhanh.
    const mau = `%${tuKhoa}%`;
    dieuKien.push(
      or(
        ilike(orders.code, mau),
        ilike(orders.customerName, mau),
        ilike(orders.customerPhone, mau),
        ilike(orders.trackingCode, mau),
        ilike(orders.externalRef, mau),
      )!,
    );
  }

  return ctx.db
    .select({
      id: orders.id,
      code: orders.code,
      channel: orders.channel,
      storeId: orders.storeId,
      storeName: stores.name,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      subtotal: orders.subtotal,
      total: orders.total,
      placedAt: orders.placedAt,
      trackingCode: orders.trackingCode,
      stockApplied: orders.stockApplied,
    })
    .from(orders)
    .leftJoin(stores, eq(stores.id, orders.storeId))
    .where(dieuKien.length ? and(...dieuKien) : undefined)
    .orderBy(desc(orders.placedAt))
    .limit(bl.gioiHan ?? 200);
}

export async function chiTietDon(ctx: Ctx, orderId: string) {
  const d = requirePermission(ctx.principal, "order.read");

  const [don] = await ctx.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!don) return null;
  if (!canTouchStore(d, don.storeId) && d.filter.kind !== "all") {
    // Có quyền đọc đơn nói chung, nhưng không phải cửa hàng này
    if (!(d.filter.kind === "self" && don.soldBy === ctx.principal.userId)) return null;
  }

  const dong = await ctx.db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId))
    .orderBy(orderLines.createdAt);

  // Giá vốn chỉ trả về khi thực sự có quyền
  const xemGiaVon = authorize(ctx.principal, "product.cost").allowed;
  const giaVon = xemGiaVon
    ? await ctx.db.select().from(orderLineCosts).where(eq(orderLineCosts.orderId, orderId))
    : [];

  return { don, dong, giaVon, xemGiaVon };
}

// ============================================================
// Ghi
// ============================================================

export type DongHangMoi = {
  skuId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export type DonMoi = {
  channel: string;
  storeId: string;
  locationId: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  province?: string;
  district?: string;
  paymentStatus?: string;
  discount?: number;
  shippingFee?: number;
  carrier?: string;
  trackingCode?: string;
  externalRef?: string;
  placedAt?: Date;
  note?: string;
  skipStock?: boolean;
  lines: DongHangMoi[];
  /** Chốt luôn sang trạng thái này sau khi tạo (POS bán xong là 'completed'). */
  chotSang?: TrangThaiDon;
};

/**
 * Tạo đơn nguyên khối: đơn + dòng hàng + (tuỳ chọn) chốt trạng thái, trong MỘT
 * transaction. Trừ kho do trigger lo, nên không có đường nào tạo được đơn mà
 * quên trừ kho.
 */
export async function taoDon(ctx: Ctx, input: DonMoi): Promise<string> {
  const d = requirePermission(ctx.principal, "order.create");
  if (!canTouchStore(d, input.storeId)) {
    throw new Error("Bạn không được tạo đơn cho cửa hàng này");
  }
  if (!input.lines.length) throw new Error("Đơn phải có ít nhất một sản phẩm");

  return trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    const [don] = await tx
      .insert(orders)
      .values({
        channel: input.channel,
        storeId: input.storeId,
        locationId: input.locationId,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        address: input.address ?? null,
        province: input.province ?? null,
        district: input.district ?? null,
        paymentStatus: input.paymentStatus ?? "unpaid",
        discount: input.discount ?? 0,
        shippingFee: input.shippingFee ?? 0,
        carrier: input.carrier ?? null,
        trackingCode: input.trackingCode ?? null,
        externalRef: input.externalRef ?? null,
        placedAt: input.placedAt ?? new Date(),
        note: input.note ?? null,
        skipStock: input.skipStock ?? false,
        soldBy: ctx.principal.userId,
        createdBy: ctx.principal.userId,
      })
      .returning({ id: orders.id, code: orders.code });

    if (!don) throw new Error("Không tạo được đơn");

    const dsSku = await tx
      .select({ id: skus.id, code: skus.code, name: skus.name })
      .from(skus)
      .where(inArray(skus.id, input.lines.map((l) => l.skuId)));
    const theoId = new Map(dsSku.map((s) => [s.id, s]));

    await tx.insert(orderLines).values(
      input.lines.map((l) => ({
        orderId: don.id,
        skuId: l.skuId,
        skuCode: theoId.get(l.skuId)?.code ?? null,
        displayName: theoId.get(l.skuId)?.name ?? null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount ?? 0,
      })),
    );

    if (input.chotSang && input.chotSang !== "new") {
      await tx.update(orders).set({ status: input.chotSang }).where(eq(orders.id, don.id));
    }

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "order.created",
      entityType: "order",
      entityId: don.id,
      newValue: { code: don.code, channel: input.channel, lines: input.lines.length },
    });

    await phatSuKien(tx, {
      name: "ORDER_CREATED",
      payload: { orderId: don.id, code: don.code, channel: input.channel },
      entityType: "order",
      entityId: don.id,
      actorUserId: ctx.principal.userId,
    });

    return don.id;
  });
}

export type DonTuSan = {
  maDonSan: string;
  ngayDat: string | null;
  khachTen: string;
  khachSdt: string;
  diaChi: string;
  tinh: string;
  quan: string;
  phiShip: number;
  giamGia: number;
  maVanDon: string;
  donViVanChuyen: string;
  trangThai: TrangThaiDon;
  lines: { skuId: string; quantity: number; unitPrice: number }[];
};

export type KetQuaNhap = {
  daNhap: number;
  boQua: number;
  loi: { maDonSan: string; lyDo: string }[];
};

/**
 * Nhập đơn từ file sàn.
 *
 * Chạy lại cùng một file KHÔNG nhân đôi đơn: mỗi đơn được ghi kèm
 * `external_ref = "<kênh>:<mã đơn của sàn>"` và những mã đã có thì bỏ qua. Đây
 * là chuyện xảy ra thật — Jen tải lại file hôm qua để bổ sung vài đơn mới, và
 * nếu hệ thống nhân đôi thì doanh thu lẫn tồn kho đều sai.
 */
export async function nhapDonTuSan(
  ctx: Ctx,
  input: { kenh: string; storeId: string; locationId: string; dons: DonTuSan[] },
): Promise<KetQuaNhap> {
  const d = requirePermission(ctx.principal, "order.create");
  if (!canTouchStore(d, input.storeId)) {
    throw new Error("Bạn không được nhập đơn cho cửa hàng này");
  }

  const kq: KetQuaNhap = { daNhap: 0, boQua: 0, loi: [] };
  if (!input.dons.length) return kq;

  const refs = input.dons.map((o) => `${input.kenh}:${o.maDonSan}`);
  const daCo = new Set(
    (
      await ctx.db
        .select({ ref: orders.externalRef })
        .from(orders)
        .where(inArray(orders.externalRef, refs))
    ).map((r) => r.ref),
  );

  for (const don of input.dons) {
    const ref = `${input.kenh}:${don.maDonSan}`;
    if (daCo.has(ref)) {
      kq.boQua++;
      continue;
    }
    if (!don.lines.length) {
      kq.loi.push({ maDonSan: don.maDonSan, lyDo: "Không có dòng hàng khớp SKU" });
      continue;
    }

    try {
      const id = await taoDon(ctx, {
        channel: input.kenh,
        storeId: input.storeId,
        locationId: input.locationId,
        customerName: don.khachTen || undefined,
        customerPhone: don.khachSdt || undefined,
        address: don.diaChi || undefined,
        province: don.tinh || undefined,
        district: don.quan || undefined,
        // Đơn trên sàn đã thu tiền hộ; ghi 'cod' để đối soát sau, không ghi
        // 'paid' vì tiền chưa thực sự về tài khoản.
        paymentStatus: "cod",
        shippingFee: don.phiShip,
        discount: don.giamGia,
        carrier: don.donViVanChuyen || undefined,
        trackingCode: don.maVanDon || undefined,
        externalRef: ref,
        placedAt: don.ngayDat ? new Date(don.ngayDat) : undefined,
        lines: don.lines,
        chotSang: don.trangThai === "new" ? undefined : don.trangThai,
      });
      if (id) kq.daNhap++;
    } catch (e) {
      // Một đơn hỏng không được làm hỏng cả lô: ghi lại lý do rồi đi tiếp.
      kq.loi.push({ maDonSan: don.maDonSan, lyDo: (e as Error).message });
    }
  }

  await ghiAudit(ctx.db, {
    actorUserId: ctx.principal.userId,
    event: "order.imported",
    entityType: "order_batch",
    entityId: input.kenh,
    newValue: { daNhap: kq.daNhap, boQua: kq.boQua, loi: kq.loi.length },
    reason: `Nhập đơn từ ${input.kenh}`,
  });

  return kq;
}

// ============================================================
// In phiếu giao hàng / hoá đơn
// ============================================================

export type DonDeIn = {
  don: typeof orders.$inferSelect;
  dong: (typeof orderLines.$inferSelect)[];
  cuaHang: { name: string; address: string | null; phone: string | null } | null;
};

/**
 * Lấy dữ liệu để in nhiều đơn một lượt.
 *
 * Áp bộ lọc phạm vi y như mọi truy vấn khác: đưa thẳng id vào URL cũng không
 * in được đơn của cửa hàng khác.
 */
export async function donDeIn(ctx: Ctx, ids: string[]): Promise<DonDeIn[]> {
  const d = requirePermission(ctx.principal, "order.read");
  if (!ids.length || boLocRong(d.filter)) return [];

  const dieuKien = [inArray(orders.id, ids)];
  if (d.filter.kind === "stores") dieuKien.push(inArray(orders.storeId, d.filter.storeIds));
  if (d.filter.kind === "self") dieuKien.push(eq(orders.soldBy, ctx.principal.userId));

  const ds = await ctx.db
    .select()
    .from(orders)
    .where(and(...dieuKien))
    .orderBy(orders.placedAt)
    .limit(200);
  if (!ds.length) return [];

  const [dong, dsCuaHang] = await Promise.all([
    ctx.db
      .select()
      .from(orderLines)
      .where(inArray(orderLines.orderId, ds.map((o) => o.id)))
      .orderBy(orderLines.createdAt),
    ctx.db
      .select({
        id: stores.id,
        name: stores.name,
        address: stores.address,
        phone: stores.phone,
      })
      .from(stores)
      .where(inArray(stores.id, [...new Set(ds.map((o) => o.storeId))])),
  ]);

  const theoDon = new Map<string, (typeof orderLines.$inferSelect)[]>();
  for (const l of dong) {
    const cur = theoDon.get(l.orderId) ?? [];
    cur.push(l);
    theoDon.set(l.orderId, cur);
  }
  const theoCuaHang = new Map(dsCuaHang.map((s) => [s.id, s]));

  return ds.map((don) => ({
    don,
    dong: theoDon.get(don.id) ?? [],
    cuaHang: theoCuaHang.get(don.storeId) ?? null,
  }));
}

// ============================================================
// Đối soát COD
// ============================================================

/** Đơn COD chưa nhận được tiền từ hãng vận chuyển. */
export async function donCodChuaDoiSoat(ctx: Ctx, carrier?: string) {
  const d = requirePermission(ctx.principal, "cod.read");
  if (boLocRong(d.filter)) return [];

  const dieuKien = [
    eq(orders.paymentStatus, "cod"),
    isNull(orders.codReconciledAt),
    // Chưa giao xong thì hãng chưa thu được tiền, đối soát làm gì
    inArray(orders.status, ["shipping", "completed"]),
  ];
  if (d.filter.kind === "stores") dieuKien.push(inArray(orders.storeId, d.filter.storeIds));
  if (carrier) dieuKien.push(eq(orders.carrier, carrier));

  return ctx.db
    .select({
      id: orders.id,
      code: orders.code,
      total: orders.total,
      trackingCode: orders.trackingCode,
      customerName: orders.customerName,
      carrier: orders.carrier,
      placedAt: orders.placedAt,
      status: orders.status,
    })
    .from(orders)
    .where(and(...dieuKien))
    .orderBy(desc(orders.placedAt))
    .limit(3000);
}

/** Các hãng vận chuyển đang có đơn COD treo, kèm số tiền chờ về. */
export async function hangVanChuyenCoCod(ctx: Ctx) {
  requirePermission(ctx.principal, "cod.read");
  const ds = await donCodChuaDoiSoat(ctx);
  const theoHang = new Map<string, { soDon: number; tongTien: number }>();
  for (const o of ds) {
    const k = o.carrier ?? "(không ghi hãng)";
    const cur = theoHang.get(k) ?? { soDon: 0, tongTien: 0 };
    cur.soDon++;
    cur.tongTien += Number(o.total);
    theoHang.set(k, cur);
  }
  return [...theoHang.entries()]
    .map(([carrier, v]) => ({ carrier, ...v }))
    .sort((a, b) => b.tongTien - a.tongTien);
}

export type DongChotDoiSoat = {
  orderId: string;
  trackingCode: string;
  soTien: number;
  soTienDuKien: number;
  trangThai: string;
};

export type KetQuaDoiSoat = {
  batchId: string;
  daChot: number;
  tongTien: number;
};

/**
 * Chốt đối soát: ghi nhận đã nhận tiền cho những đơn người dùng chọn.
 *
 * CHỈ ghi nhận đúng những dòng được gửi lên — dòng lệch tiền hay không tìm thấy
 * đơn vẫn được lưu vào đợt để tra ngược, nhưng không tự đánh dấu đã thu. Máy
 * đoán sai mà tự chốt thì tiền sai mà không ai biết.
 */
export async function chotDoiSoatCod(
  ctx: Ctx,
  input: {
    carrier: string;
    fileName?: string;
    /** Những dòng người dùng đồng ý ghi nhận đã nhận tiền. */
    chot: DongChotDoiSoat[];
    /** Toàn bộ dòng đọc được từ file, kể cả dòng không chốt — để lưu vết. */
    tatCa: DongChotDoiSoat[];
    note?: string;
  },
): Promise<KetQuaDoiSoat> {
  requirePermission(ctx.principal, "cod.reconcile");

  return trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    const tongKhai = input.tatCa.reduce((s, r) => s + r.soTien, 0);
    const tongChot = input.chot.reduce((s, r) => s + r.soTien, 0);

    const [batch] = await tx
      .insert(codBatches)
      .values({
        carrier: input.carrier,
        fileName: input.fileName ?? null,
        totalReported: tongKhai,
        totalMatched: tongChot,
        matchedCount: input.tatCa.filter((r) => r.trangThai === "khop").length,
        diffCount: input.tatCa.filter((r) => r.trangThai === "lech").length,
        missingCount: input.tatCa.filter((r) => r.trangThai === "khong_thay").length,
        note: input.note ?? null,
        createdBy: ctx.principal.userId,
      })
      .returning({ id: codBatches.id });
    if (!batch) throw new Error("Không tạo được đợt đối soát");

    if (input.tatCa.length) {
      await tx.insert(codBatchLines).values(
        input.tatCa.map((r) => ({
          batchId: batch.id,
          trackingCode: r.trackingCode,
          amountReported: r.soTien,
          amountExpected: r.soTienDuKien || null,
          orderId: r.orderId || null,
          status: r.trangThai,
        })),
      );
    }

    for (const r of input.chot) {
      if (!r.orderId) continue;
      await tx
        .update(orders)
        .set({ codReconciledAt: new Date(), codAmount: r.soTien, paymentStatus: "paid" })
        .where(and(eq(orders.id, r.orderId), isNull(orders.codReconciledAt)));
    }

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "cod.reconciled",
      entityType: "cod_batch",
      entityId: batch.id,
      newValue: {
        carrier: input.carrier,
        daChot: input.chot.length,
        tongTien: tongChot,
        lech: input.tatCa.filter((r) => r.trangThai === "lech").length,
      },
      reason: `Đối soát COD với ${input.carrier}`,
    });

    return { batchId: batch.id, daChot: input.chot.length, tongTien: tongChot };
  });
}

/** Lịch sử các đợt đối soát. */
export async function lichSuDoiSoat(ctx: Ctx, gioiHan = 30) {
  requirePermission(ctx.principal, "cod.read");
  return ctx.db
    .select()
    .from(codBatches)
    .orderBy(desc(codBatches.createdAt))
    .limit(gioiHan);
}

/** Đổi trạng thái đơn. Trừ/hoàn kho do trigger lo. */
export async function doiTrangThai(
  ctx: Ctx,
  orderId: string,
  trangThaiMoi: TrangThaiDon,
): Promise<void> {
  const d = requirePermission(ctx.principal, "order.create");

  const [truoc] = await ctx.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!truoc) throw new Error("Không tìm thấy đơn");
  if (!canTouchStore(d, truoc.storeId)) {
    throw new Error("Bạn không được sửa đơn của cửa hàng này");
  }
  if (truoc.status === trangThaiMoi) return;

  const chuyenDuoc = CHUYEN_TRANG_THAI[truoc.status as TrangThaiDon] ?? [];
  if (!chuyenDuoc.includes(trangThaiMoi)) {
    throw new Error(
      `Không chuyển được từ "${NHAN_TRANG_THAI[truoc.status as TrangThaiDon] ?? truoc.status}"` +
        ` sang "${NHAN_TRANG_THAI[trangThaiMoi]}"`,
    );
  }

  await trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    await tx.update(orders).set({ status: trangThaiMoi }).where(eq(orders.id, orderId));

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "order.status_changed",
      entityType: "order",
      entityId: orderId,
      previousValue: { status: truoc.status },
      newValue: { status: trangThaiMoi },
    });

    if (trangThaiMoi === "completed") {
      await phatSuKien(tx, {
        name: "ORDER_PAID",
        payload: { orderId, code: truoc.code, total: truoc.total },
        entityType: "order",
        entityId: orderId,
        actorUserId: ctx.principal.userId,
      });
    }
  });
}

// ============================================================
// Số liệu
// ============================================================

export type ThongKe = {
  soDon: number;
  doanhThu: number;
  tienHang: number;
  giaVon: number;
  loiNhuan: number;
  soSanPham: number;
  giaTriTB: number;
  donCanXuLy: number;
  codDangGiao: number;
  xemDuocLoiNhuan: boolean;
};

/** Số liệu tổng hợp, tính trên đúng phạm vi dữ liệu của người gọi. */
export async function thongKe(ctx: Ctx, tuNgay: Date, denNgay: Date): Promise<ThongKe> {
  const ds = await danhSachDon(ctx, { tuNgay, denNgay, gioiHan: 10000 });
  const xemGiaVon = authorize(ctx.principal, "product.cost").allowed;

  const idHoanThanh = ds.filter((o) => TINH_DOANH_THU.includes(o.status as TrangThaiDon)).map((o) => o.id);

  let soSanPham = 0;
  let giaVon = 0;
  if (idHoanThanh.length) {
    const [sl] = await ctx.db
      .select({ n: sql<number>`coalesce(sum(${orderLines.quantity}), 0)::int` })
      .from(orderLines)
      .where(inArray(orderLines.orderId, idHoanThanh));
    soSanPham = sl?.n ?? 0;

    if (xemGiaVon) {
      const [von] = await ctx.db
        .select({
          n: sql<number>`coalesce(sum(${orderLineCosts.unitCost} * ${orderLines.quantity}), 0)::bigint`,
        })
        .from(orderLineCosts)
        .innerJoin(orderLines, eq(orderLines.id, orderLineCosts.orderLineId))
        .where(inArray(orderLineCosts.orderId, idHoanThanh));
      giaVon = Number(von?.n ?? 0);
    }
  }

  const hoanThanh = ds.filter((o) => TINH_DOANH_THU.includes(o.status as TrangThaiDon));
  const doanhThu = hoanThanh.reduce((s, o) => s + Number(o.total), 0);
  const tienHang = hoanThanh.reduce((s, o) => s + Number(o.subtotal), 0);

  return {
    soDon: hoanThanh.length,
    doanhThu,
    tienHang,
    giaVon,
    loiNhuan: xemGiaVon ? tienHang - giaVon : 0,
    soSanPham,
    giaTriTB: hoanThanh.length ? Math.round(doanhThu / hoanThanh.length) : 0,
    donCanXuLy: ds.filter((o) => o.status === "new" || o.status === "confirmed").length,
    codDangGiao: ds
      .filter((o) => o.status === "shipping" && o.paymentStatus === "cod")
      .reduce((s, o) => s + Number(o.total), 0),
    xemDuocLoiNhuan: xemGiaVon,
  };
}

/** Doanh thu gộp theo kênh. */
export async function doanhThuTheoKenh(ctx: Ctx, tuNgay: Date, denNgay: Date) {
  const ds = await danhSachDon(ctx, { tuNgay, denNgay, gioiHan: 10000 });
  const m = new Map<string, { doanhThu: number; soDon: number }>();
  for (const o of ds) {
    if (!TINH_DOANH_THU.includes(o.status as TrangThaiDon)) continue;
    const cur = m.get(o.channel) ?? { doanhThu: 0, soDon: 0 };
    cur.doanhThu += Number(o.total);
    cur.soDon += 1;
    m.set(o.channel, cur);
  }
  return [...m.entries()]
    .map(([kenh, v]) => ({ kenh, ...v }))
    .sort((a, b) => b.doanhThu - a.doanhThu);
}

/** Địa điểm kho mà người này được bán ra từ đó. */
export async function diaDiemBanDuoc(ctx: Ctx) {
  const d = authorize(ctx.principal, "order.create");
  if (!d.allowed || boLocRong(d.filter)) return [];

  const dieuKien = [eq(inventoryLocations.kind, "sellable"), eq(inventoryLocations.isActive, true)];
  if (d.filter.kind === "stores") {
    dieuKien.push(inArray(inventoryLocations.storeId, d.filter.storeIds));
  }

  return ctx.db
    .select({
      id: inventoryLocations.id,
      code: inventoryLocations.code,
      name: inventoryLocations.name,
      storeId: inventoryLocations.storeId,
      storeName: stores.name,
      managedBy: inventoryLocations.managedBy,
    })
    .from(inventoryLocations)
    .leftJoin(stores, eq(stores.id, inventoryLocations.storeId))
    .where(and(...dieuKien))
    .orderBy(inventoryLocations.code);
}
