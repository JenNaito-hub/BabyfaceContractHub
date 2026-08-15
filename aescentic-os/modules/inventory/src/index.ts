import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ghiAudit,
  inventoryBalances,
  inventoryLocations,
  inventoryTransactions,
  productCosts,
  products,
  skus,
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

/** SKU dưới ngưỡng cảnh báo, trong phạm vi người gọi được xem. */
export async function sapHetHang(ctx: Ctx, gioiHan = 10) {
  const bang = await bangTonKho(ctx);
  return bang
    .filter((r) => r.tong <= r.reorderPoint)
    .sort((a, b) => a.tong - b.tong)
    .slice(0, gioiHan);
}
