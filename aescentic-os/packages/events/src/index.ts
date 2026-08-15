import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import { domainEvents, type Db } from "@aescentic/database";

/**
 * Domain event theo mẫu outbox.
 *
 * Event được ghi TRONG CÙNG transaction với thao tác nghiệp vụ. Nhờ vậy không
 * bao giờ có chuyện "đơn đã tạo nhưng event mất" hay ngược lại. Worker đọc bảng
 * này và xử lý sau — hệ thống vẫn chạy đúng khi chưa có Redis.
 */

export const SU_KIEN = [
  "ORDER_CREATED",
  "ORDER_PAID",
  "ORDER_CANCELLED",
  "INVENTORY_LOW",
  "INVENTORY_ADJUSTED",
  "STOCK_TRANSFER_SENT",
  "STOCK_TRANSFER_RECEIVED",
  "CUSTOMER_CREATED",
  "CUSTOMER_AT_RISK",
  "PRODUCT_LAUNCHED",
  "CAMPAIGN_PUBLISHED",
  "EMPLOYEE_LEAVE_APPROVED",
  "SHIFT_UNDERSTAFFED",
  "B2B_CONTRACT_SIGNED",
  "PAYMENT_COLLECTED",
  "COMMISSION_ELIGIBLE",
  "INVOICE_ISSUED",
  "PAYROLL_APPROVED",
  "SYNC_FAILED",
] as const;

export type TenSuKien = (typeof SU_KIEN)[number];

export type PhatSuKienInput = {
  name: TenSuKien;
  payload: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  actorUserId?: string | null;
};

/** Ghi event vào outbox. Phải gọi trong transaction của nghiệp vụ. */
export async function phatSuKien(db: Db, input: PhatSuKienInput): Promise<void> {
  await db.insert(domainEvents).values({
    name: input.name,
    payload: input.payload as never,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actorUserId: input.actorUserId ?? null,
  });
}

/** Lấy lô event chưa xử lý cho worker. */
export async function layEventChuaXuLy(db: Db, gioiHan = 100) {
  return db
    .select()
    .from(domainEvents)
    .where(and(isNull(domainEvents.processedAt), lt(domainEvents.attempts, 5)))
    .orderBy(asc(domainEvents.occurredAt))
    .limit(gioiHan);
}

export async function danhDauDaXuLy(db: Db, id: number): Promise<void> {
  await db
    .update(domainEvents)
    .set({ processedAt: new Date() })
    .where(eq(domainEvents.id, id));
}

/** Ghi nhận thất bại. Quá 5 lần thì thôi thử lại, để lộ ra ở admin health. */
export async function danhDauThatBai(db: Db, id: number, loi: string): Promise<void> {
  await db
    .update(domainEvents)
    .set({ attempts: sql`${domainEvents.attempts} + 1`, lastError: loi.slice(0, 2000) })
    .where(eq(domainEvents.id, id));
}
