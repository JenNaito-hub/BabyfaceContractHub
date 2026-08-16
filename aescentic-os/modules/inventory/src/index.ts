import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  ghiAudit,
  inventoryBalances,
  inventoryLocations,
  inventoryTransactions,
  productCosts,
  products,
  receiptLines,
  skus,
  stockReceipts,
  stockTransfers,
  transferLines,
  stores,
  trongGiaoDich,
  type Db,
} from "@aescentic/database";
import {
  authorize,
  boLocRong,
  requirePermission,
  type Principal,
} from "@aescentic/permissions";
import { phatSuKien } from "@aescentic/events";

export type Ctx = { db: Db; principal: Principal };

// Nhãn ở `labels.ts` để client import được mà không kéo theo database.
export * from "./labels.ts";

/** Các địa điểm kho người gọi được xem. */
export async function diaDiemXemDuoc(ctx: Ctx) {
  const d = requirePermission(ctx.principal, "inventory.read");
  if (boLocRong(d.filter)) return [];

  const dieuKien = [eq(inventoryLocations.isActive, true)];
  if (d.filter.kind === "stores") {
    dieuKien.push(inArray(inventoryLocations.storeId, d.filter.storeIds));
  }

  return ctx.db
    .select({
      id: inventoryLocations.id,
      code: inventoryLocations.code,
      name: inventoryLocations.name,
      kind: inventoryLocations.kind,
      managedBy: inventoryLocations.managedBy,
      storeId: inventoryLocations.storeId,
      storeName: stores.name,
    })
    .from(inventoryLocations)
    .leftJoin(stores, eq(stores.id, inventoryLocations.storeId))
    .where(and(...dieuKien))
    .orderBy(inventoryLocations.code);
}

export type DongTon = {
  skuId: string;
  skuCode: string;
  skuName: string | null;
  productName: string;
  reorderPoint: number;
  retailPrice: number;
  unitCost: number | null;
  theoDiaDiem: Record<string, number>;
  tong: number;
};

/** Bảng tồn kho: mỗi dòng một SKU, mỗi cột một địa điểm được phép xem. */
export async function bangTonKho(ctx: Ctx): Promise<DongTon[]> {
  const diaDiem = await diaDiemXemDuoc(ctx);
  if (!diaDiem.length) return [];
  const idDiaDiem = diaDiem.map((l) => l.id);

  const xemGiaVon = authorize(ctx.principal, "product.cost").allowed;

  const [dsSku, soDu, giaVon] = await Promise.all([
    ctx.db
      .select({
        id: skus.id,
        code: skus.code,
        name: skus.name,
        reorderPoint: skus.reorderPoint,
        retailPrice: skus.retailPrice,
        productName: products.name,
      })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .where(eq(skus.isActive, true))
      .orderBy(skus.code),
    ctx.db
      .select()
      .from(inventoryBalances)
      .where(inArray(inventoryBalances.locationId, idDiaDiem)),
    xemGiaVon ? ctx.db.select().from(productCosts) : Promise.resolve([]),
  ]);

  const von = new Map(giaVon.map((c) => [c.skuId, c.unitCost]));
  const theoSku = new Map<string, Record<string, number>>();
  for (const b of soDu) {
    const cur = theoSku.get(b.skuId) ?? {};
    cur[b.locationId] = b.quantity;
    theoSku.set(b.skuId, cur);
  }

  return dsSku.map((s) => {
    const theoDiaDiem = theoSku.get(s.id) ?? {};
    return {
      skuId: s.id,
      skuCode: s.code,
      skuName: s.name,
      productName: s.productName,
      reorderPoint: s.reorderPoint,
      retailPrice: s.retailPrice,
      unitCost: xemGiaVon ? (von.get(s.id) ?? 0) : null,
      theoDiaDiem,
      tong: Object.values(theoDiaDiem).reduce((a, b) => a + b, 0),
    };
  });
}

/** Tồn của một địa điểm cụ thể — dùng cho POS. */
export async function tonTheoDiaDiem(ctx: Ctx, locationId: string) {
  requirePermission(ctx.principal, "inventory.read");
  const rows = await ctx.db
    .select({ skuId: inventoryBalances.skuId, quantity: inventoryBalances.quantity })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.locationId, locationId));
  return new Map(rows.map((r) => [r.skuId, r.quantity]));
}

/** Sổ kho gần đây, giới hạn trong địa điểm được phép xem. */
export async function soKho(ctx: Ctx, gioiHan = 80) {
  const diaDiem = await diaDiemXemDuoc(ctx);
  if (!diaDiem.length) return [];

  return ctx.db
    .select({
      id: inventoryTransactions.id,
      delta: inventoryTransactions.delta,
      kind: inventoryTransactions.kind,
      note: inventoryTransactions.note,
      createdAt: inventoryTransactions.createdAt,
      skuCode: skus.code,
      productName: products.name,
      locationName: inventoryLocations.name,
    })
    .from(inventoryTransactions)
    .innerJoin(skus, eq(skus.id, inventoryTransactions.skuId))
    .innerJoin(products, eq(products.id, skus.productId))
    .innerJoin(inventoryLocations, eq(inventoryLocations.id, inventoryTransactions.locationId))
    .where(inArray(inventoryTransactions.locationId, diaDiem.map((l) => l.id)))
    .orderBy(desc(inventoryTransactions.createdAt))
    .limit(gioiHan);
}

/**
 * Kiểm kho: đưa tồn về đúng số đếm thực tế.
 * Chênh lệch được ghi thành một dòng sổ kho, không sửa đè con số.
 */
export async function dieuChinhTon(
  ctx: Ctx,
  input: { skuId: string; locationId: string; thucTe: number; lyDo: string },
): Promise<number> {
  const d = requirePermission(ctx.principal, "inventory.adjust");

  const [dd] = await ctx.db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.id, input.locationId))
    .limit(1);
  if (!dd) throw new Error("Không tìm thấy địa điểm kho");

  // Quyền theo cửa hàng: chỉ đụng được kho của cửa hàng mình
  if (d.filter.kind === "stores" && (!dd.storeId || !d.filter.storeIds.includes(dd.storeId))) {
    throw new Error("Bạn không được điều chỉnh tồn ở địa điểm này");
  }
  if (!input.lyDo.trim()) throw new Error("Phải ghi lý do điều chỉnh");

  return trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    const [truoc] = await tx
      .select({ quantity: inventoryBalances.quantity })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.skuId, input.skuId),
          eq(inventoryBalances.locationId, input.locationId),
        ),
      );

    const [kq] = await tx.execute<{ dieu_chinh_ton: number }>(
      sql`select os.dieu_chinh_ton(${input.skuId}::uuid, ${input.locationId}::uuid,
                                   ${input.thucTe}::int, ${input.lyDo})`,
    );
    const delta = Number(kq?.dieu_chinh_ton ?? 0);

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "inventory.adjusted",
      entityType: "sku",
      entityId: input.skuId,
      previousValue: { quantity: truoc?.quantity ?? 0, locationId: input.locationId },
      newValue: { quantity: input.thucTe, delta },
      reason: input.lyDo,
    });

    if (delta !== 0) {
      await phatSuKien(tx, {
        name: "INVENTORY_ADJUSTED",
        payload: { skuId: input.skuId, locationId: input.locationId, delta },
        entityType: "sku",
        entityId: input.skuId,
        actorUserId: ctx.principal.userId,
      });
    }

    return delta;
  });
}

// ============================================================
// Nhập kho
// ============================================================

export type DongNhap = { skuId: string; quantity: number; unitCost: number };

/**
 * Tạo phiếu nhập và chốt luôn.
 *
 * Chốt xong trigger cộng kho VÀ cập nhật giá vốn — nên nhập sai giá là lợi
 * nhuận của mọi đơn bán sau đó sai theo. Vì vậy bắt buộc có đơn giá, không cho
 * để trống rồi tính sau.
 */
export async function nhapKho(
  ctx: Ctx,
  input: {
    locationId: string;
    supplierName?: string;
    receivedOn?: string;
    note?: string;
    lines: DongNhap[];
    /** Để `false` khi muốn lưu nháp, sửa rồi mới chốt. */
    chotLuon?: boolean;
  },
): Promise<{ id: string; code: string }> {
  const d = requirePermission(ctx.principal, "inventory.adjust");
  if (!input.lines.length) throw new Error("Phiếu nhập phải có ít nhất một sản phẩm");

  const [dd] = await ctx.db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.id, input.locationId))
    .limit(1);
  if (!dd) throw new Error("Không tìm thấy địa điểm kho");
  if (d.filter.kind === "stores" && (!dd.storeId || !d.filter.storeIds.includes(dd.storeId))) {
    throw new Error("Bạn không được nhập hàng vào kho này");
  }
  for (const l of input.lines) {
    if (l.quantity <= 0) throw new Error("Số lượng nhập phải lớn hơn 0");
    if (l.unitCost < 0) throw new Error("Giá vốn không được âm");
  }

  return trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    const [phieu] = await tx
      .insert(stockReceipts)
      .values({
        locationId: input.locationId,
        supplierName: input.supplierName ?? null,
        ...(input.receivedOn ? { receivedOn: input.receivedOn } : {}),
        note: input.note ?? null,
        createdBy: ctx.principal.userId,
      })
      .returning({ id: stockReceipts.id, code: stockReceipts.code });
    if (!phieu) throw new Error("Không tạo được phiếu nhập");

    await tx.insert(receiptLines).values(
      input.lines.map((l) => ({
        receiptId: phieu.id,
        skuId: l.skuId,
        quantity: l.quantity,
        unitCost: l.unitCost,
      })),
    );

    if (input.chotLuon !== false) {
      await tx
        .update(stockReceipts)
        .set({ status: "completed" })
        .where(eq(stockReceipts.id, phieu.id));
    }

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "inventory.received",
      entityType: "stock_receipt",
      entityId: phieu.id,
      newValue: {
        code: phieu.code,
        locationId: input.locationId,
        soDong: input.lines.length,
        soLuong: input.lines.reduce((s, l) => s + l.quantity, 0),
        tongTien: input.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0),
      },
      reason: input.note ?? null,
    });

    await phatSuKien(tx, {
      name: "STOCK_RECEIVED",
      payload: { receiptId: phieu.id, locationId: input.locationId },
      entityType: "stock_receipt",
      entityId: phieu.id,
      actorUserId: ctx.principal.userId,
    });

    return phieu;
  });
}

/** Phiếu nhập gần đây, giới hạn trong địa điểm được phép xem. */
export async function danhSachNhap(ctx: Ctx, gioiHan = 50) {
  const diaDiem = await diaDiemXemDuoc(ctx);
  if (!diaDiem.length) return [];

  return ctx.db
    .select({
      id: stockReceipts.id,
      code: stockReceipts.code,
      status: stockReceipts.status,
      supplierName: stockReceipts.supplierName,
      receivedOn: stockReceipts.receivedOn,
      note: stockReceipts.note,
      createdAt: stockReceipts.createdAt,
      locationName: inventoryLocations.name,
      soLuong: sql<number>`coalesce((
        select sum(quantity)::int from os.receipt_lines rl where rl.receipt_id = ${stockReceipts.id}
      ), 0)`,
      tongTien: sql<number>`coalesce((
        select sum(quantity * unit_cost)::bigint from os.receipt_lines rl
        where rl.receipt_id = ${stockReceipts.id}
      ), 0)`,
    })
    .from(stockReceipts)
    .innerJoin(inventoryLocations, eq(inventoryLocations.id, stockReceipts.locationId))
    .where(inArray(stockReceipts.locationId, diaDiem.map((l) => l.id)))
    .orderBy(desc(stockReceipts.createdAt))
    .limit(gioiHan);
}

// ============================================================
// Chuyển kho
// ============================================================

export const NHAN_TRANG_THAI_CHUYEN: Record<string, string> = {
  draft: "Nháp",
  in_transit: "Đang chuyển",
  received: "Đã nhận",
  cancelled: "Huỷ",
};

/**
 * Tạo phiếu chuyển kho và xuất hàng đi luôn.
 *
 * Hàng rời kho gửi ngay khi chuyển sang `in_transit`, nhưng chỉ vào kho nhận
 * khi bên kia bấm "đã nhận". Quãng giữa hàng nằm ở trạng thái đang chuyển —
 * không thuộc kho nào cả, đúng như thực tế.
 */
export async function chuyenKho(
  ctx: Ctx,
  input: {
    fromLocationId: string;
    toLocationId: string;
    note?: string;
    lines: { skuId: string; quantity: number }[];
  },
): Promise<{ id: string; code: string }> {
  const d = requirePermission(ctx.principal, "inventory.transfer");
  if (!input.lines.length) throw new Error("Phiếu chuyển phải có ít nhất một sản phẩm");
  if (input.fromLocationId === input.toLocationId) {
    throw new Error("Kho gửi và kho nhận phải khác nhau");
  }
  for (const l of input.lines) {
    if (l.quantity <= 0) throw new Error("Số lượng chuyển phải lớn hơn 0");
  }

  const dsDiaDiem = await ctx.db
    .select()
    .from(inventoryLocations)
    .where(inArray(inventoryLocations.id, [input.fromLocationId, input.toLocationId]));
  if (dsDiaDiem.length !== 2) throw new Error("Không tìm thấy địa điểm kho");

  if (d.filter.kind === "stores") {
    const gui = dsDiaDiem.find((l) => l.id === input.fromLocationId)!;
    if (!gui.storeId || !d.filter.storeIds.includes(gui.storeId)) {
      throw new Error("Bạn không được chuyển hàng đi từ kho này");
    }
  }

  return trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    const [phieu] = await tx
      .insert(stockTransfers)
      .values({
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        note: input.note ?? null,
        createdBy: ctx.principal.userId,
      })
      .returning({ id: stockTransfers.id, code: stockTransfers.code });
    if (!phieu) throw new Error("Không tạo được phiếu chuyển");

    await tx.insert(transferLines).values(
      input.lines.map((l) => ({ transferId: phieu.id, skuId: l.skuId, quantity: l.quantity })),
    );

    // Trigger kiểm đủ hàng rồi trừ kho gửi; thiếu hàng là ném lỗi ở đây.
    await tx
      .update(stockTransfers)
      .set({ status: "in_transit" })
      .where(eq(stockTransfers.id, phieu.id));

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "inventory.transfer_sent",
      entityType: "stock_transfer",
      entityId: phieu.id,
      newValue: {
        code: phieu.code,
        from: input.fromLocationId,
        to: input.toLocationId,
        soLuong: input.lines.reduce((s, l) => s + l.quantity, 0),
      },
      reason: input.note ?? null,
    });

    await phatSuKien(tx, {
      name: "STOCK_TRANSFER_SENT",
      payload: { transferId: phieu.id, from: input.fromLocationId, to: input.toLocationId },
      entityType: "stock_transfer",
      entityId: phieu.id,
      actorUserId: ctx.principal.userId,
    });

    return phieu;
  });
}

/** Bên nhận xác nhận đã nhận đủ hàng — lúc này hàng mới vào kho nhận. */
export async function nhanHangChuyen(ctx: Ctx, transferId: string): Promise<void> {
  const d = requirePermission(ctx.principal, "inventory.transfer");

  const [phieu] = await ctx.db
    .select()
    .from(stockTransfers)
    .where(eq(stockTransfers.id, transferId))
    .limit(1);
  if (!phieu) throw new Error("Không tìm thấy phiếu chuyển");
  if (phieu.status !== "in_transit") {
    throw new Error(`Phiếu đang ở trạng thái "${NHAN_TRANG_THAI_CHUYEN[phieu.status] ?? phieu.status}", không nhận được`);
  }

  if (d.filter.kind === "stores") {
    const [den] = await ctx.db
      .select()
      .from(inventoryLocations)
      .where(eq(inventoryLocations.id, phieu.toLocationId))
      .limit(1);
    if (!den?.storeId || !d.filter.storeIds.includes(den.storeId)) {
      throw new Error("Bạn không được nhận hàng vào kho này");
    }
  }

  await trongGiaoDich(ctx.db, ctx.principal.userId, async (tx) => {
    await tx
      .update(stockTransfers)
      .set({ status: "received" })
      .where(eq(stockTransfers.id, transferId));

    await ghiAudit(tx, {
      actorUserId: ctx.principal.userId,
      event: "inventory.transfer_received",
      entityType: "stock_transfer",
      entityId: transferId,
      previousValue: { status: "in_transit" },
      newValue: { status: "received" },
    });

    await phatSuKien(tx, {
      name: "STOCK_TRANSFER_RECEIVED",
      payload: { transferId, locationId: phieu.toLocationId },
      entityType: "stock_transfer",
      entityId: transferId,
      actorUserId: ctx.principal.userId,
    });
  });
}

/** Phiếu chuyển gần đây liên quan tới địa điểm người gọi xem được. */
export async function danhSachChuyen(ctx: Ctx, gioiHan = 50) {
  const diaDiem = await diaDiemXemDuoc(ctx);
  if (!diaDiem.length) return [];
  const ids = diaDiem.map((l) => l.id);

  const tuKho = alias(inventoryLocations, "tu_kho");
  const denKho = alias(inventoryLocations, "den_kho");

  return ctx.db
    .select({
      id: stockTransfers.id,
      code: stockTransfers.code,
      status: stockTransfers.status,
      movedOn: stockTransfers.movedOn,
      note: stockTransfers.note,
      createdAt: stockTransfers.createdAt,
      tuKhoId: stockTransfers.fromLocationId,
      denKhoId: stockTransfers.toLocationId,
      tuKhoTen: tuKho.name,
      denKhoTen: denKho.name,
      soLuong: sql<number>`coalesce((
        select sum(quantity)::int from os.transfer_lines tl
        where tl.transfer_id = ${stockTransfers.id}
      ), 0)`,
    })
    .from(stockTransfers)
    .innerJoin(tuKho, eq(tuKho.id, stockTransfers.fromLocationId))
    .innerJoin(denKho, eq(denKho.id, stockTransfers.toLocationId))
    .where(
      or(
        inArray(stockTransfers.fromLocationId, ids),
        inArray(stockTransfers.toLocationId, ids),
      ),
    )
    .orderBy(desc(stockTransfers.createdAt))
    .limit(gioiHan);
}

/** SKU dưới ngưỡng cảnh báo, trong phạm vi người gọi được xem. */
export async function sapHetHang(ctx: Ctx, gioiHan = 10) {
  const bang = await bangTonKho(ctx);
  return bang
    .filter((r) => r.tong <= r.reorderPoint)
    .sort((a, b) => a.tong - b.tong)
    .slice(0, gioiHan);
}
