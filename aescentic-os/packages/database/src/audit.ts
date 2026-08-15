import { auditLog } from "./schema/index.ts";
import type { Db } from "./client.ts";

/**
 * Ghi nhật ký kiểm toán.
 *
 * Bắt buộc cho: tiền, kho, lương, quyền, hợp đồng.
 * Gọi TRONG cùng transaction với thao tác nghiệp vụ — nếu nghiệp vụ rollback thì
 * audit cũng phải rollback, nếu không nhật ký sẽ nói dối.
 */
export type GhiAuditInput = {
  actorUserId: string | null;
  actorLabel?: string | null;
  /** Dạng `domain.hanh_dong`, ví dụ `inventory.adjusted`, `payroll.approved`. */
  event: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  approverUserId?: string | null;
  requestId?: string | null;
};

export async function ghiAudit(db: Db, input: GhiAuditInput): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel ?? null,
    event: input.event,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    previousValue: (input.previousValue ?? null) as never,
    newValue: (input.newValue ?? null) as never,
    reason: input.reason ?? null,
    approverUserId: input.approverUserId ?? null,
    requestId: input.requestId ?? null,
  });
}

/**
 * So sánh trước/sau và chỉ ghi những trường thực sự đổi.
 * Nhật ký chép nguyên cả bản ghi mỗi lần sửa một ô sẽ nhanh chóng thành vô dụng.
 */
export function chiTruongDoi<T extends Record<string, unknown>>(
  truoc: T,
  sau: Partial<T>,
): { previousValue: Partial<T>; newValue: Partial<T>; coDoi: boolean } {
  const p: Partial<T> = {};
  const n: Partial<T> = {};
  for (const k of Object.keys(sau) as (keyof T)[]) {
    if (JSON.stringify(truoc[k]) !== JSON.stringify(sau[k])) {
      p[k] = truoc[k];
      n[k] = sau[k];
    }
  }
  return { previousValue: p, newValue: n, coDoi: Object.keys(n).length > 0 };
}
