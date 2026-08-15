import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { configSettings, type Db } from "@aescentic/database";

/**
 * Cấu hình có phiên bản theo thời gian.
 *
 * Vì sao quan trọng: bảng lương tháng 3 phải dùng tỷ lệ hoa hồng CÓ HIỆU LỰC
 * tháng 3, kể cả khi tháng 5 đã đổi tỷ lệ. Đọc cấu hình mà không kèm thời điểm
 * là cách chắc chắn nhất để tính sai lương quá khứ.
 */

export type ScopeType = "global" | "store" | "department" | "role";

export type DocCauHinhInput = {
  key: string;
  /** Thời điểm cần lấy giá trị. Mặc định bây giờ. */
  at?: Date;
  scopeType?: ScopeType;
  scopeId?: string | null;
};

/**
 * Lấy giá trị cấu hình tại một thời điểm.
 *
 * Thứ tự ưu tiên: cấu hình theo scope cụ thể (cửa hàng/phòng ban) thắng cấu hình
 * global. Cùng scope thì bản có `effective_from` muộn nhất thắng.
 */
export async function docCauHinh<T = unknown>(
  db: Db,
  input: DocCauHinhInput,
): Promise<T | null> {
  const at = input.at ?? new Date();
  const scopeType = input.scopeType ?? "global";

  const dieuKienThoiGian = and(
    lte(configSettings.effectiveFrom, at),
    or(isNull(configSettings.effectiveTo), gt(configSettings.effectiveTo, at)),
  );

  if (scopeType !== "global" && input.scopeId) {
    const [rieng] = await db
      .select({ value: configSettings.value })
      .from(configSettings)
      .where(
        and(
          eq(configSettings.key, input.key),
          eq(configSettings.scopeType, scopeType),
          eq(configSettings.scopeId, input.scopeId),
          dieuKienThoiGian,
        ),
      )
      .orderBy(desc(configSettings.effectiveFrom))
      .limit(1);
    if (rieng) return rieng.value as T;
  }

  const [chung] = await db
    .select({ value: configSettings.value })
    .from(configSettings)
    .where(
      and(
        eq(configSettings.key, input.key),
        eq(configSettings.scopeType, "global"),
        dieuKienThoiGian,
      ),
    )
    .orderBy(desc(configSettings.effectiveFrom))
    .limit(1);

  return chung ? (chung.value as T) : null;
}

/** Như `docCauHinh` nhưng có giá trị mặc định thay vì null. */
export async function docCauHinhMacDinh<T>(
  db: Db,
  input: DocCauHinhInput,
  macDinh: T,
): Promise<T> {
  const v = await docCauHinh<T>(db, input);
  return v === null ? macDinh : v;
}

export type DatCauHinhInput = {
  key: string;
  value: unknown;
  effectiveFrom?: Date;
  scopeType?: ScopeType;
  scopeId?: string | null;
  note?: string;
  createdBy?: string | null;
};

/**
 * Đặt giá trị mới có hiệu lực từ một thời điểm.
 *
 * KHÔNG sửa đè bản cũ: đóng bản đang hiệu lực bằng `effective_to` rồi thêm bản
 * mới. Nhờ vậy lịch sử luôn tra được, và số liệu quá khứ không đổi theo.
 */
export async function datCauHinh(db: Db, input: DatCauHinhInput): Promise<void> {
  const from = input.effectiveFrom ?? new Date();
  const scopeType = input.scopeType ?? "global";
  const scopeId = input.scopeId ?? null;

  await db.transaction(async (tx) => {
    await tx
      .update(configSettings)
      .set({ effectiveTo: from })
      .where(
        and(
          eq(configSettings.key, input.key),
          eq(configSettings.scopeType, scopeType),
          scopeId === null
            ? isNull(configSettings.scopeId)
            : eq(configSettings.scopeId, scopeId),
          isNull(configSettings.effectiveTo),
          lte(configSettings.effectiveFrom, from),
        ),
      );

    await tx.insert(configSettings).values({
      key: input.key,
      value: input.value as never,
      scopeType,
      scopeId,
      effectiveFrom: from,
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
    });
  });
}

/** Toàn bộ lịch sử một khoá — dùng cho màn hình audit cấu hình. */
export async function lichSuCauHinh(db: Db, key: string) {
  return db
    .select()
    .from(configSettings)
    .where(eq(configSettings.key, key))
    .orderBy(desc(configSettings.effectiveFrom));
}

export const CAU_HINH_MAC_DINH = {
  "inventory.low_stock_days": 14,
  "payroll.overtime_multiplier": 1.5,
  "payroll.late_grace_minutes": 5,
  "b2b.commission_trigger": "collected",
  "loyalty.points_per_1000_vnd": 1,
  "ai.monthly_token_budget": 5_000_000,
} as const;

export { sql };
