import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export type Db = ReturnType<typeof taoDb>;

/**
 * Kết nối dùng chung được gắn vào `globalThis`, không phải biến trong module.
 *
 * Ở chế độ dev, Next.js nạp lại module mỗi lần sửa file. Nếu giữ singleton
 * trong phạm vi module thì mỗi lần nạp lại mở thêm một pool 10 kết nối mà pool
 * cũ không ai đóng — sửa file mươi lần là PostgreSQL báo "too many clients" và
 * cả app chết. Gắn vào globalThis thì mọi lần nạp lại đều dùng chung một pool.
 */
type KhoChung = { _sql?: postgres.Sql | null; _db?: Db | null };
const khoChung = globalThis as unknown as { __aescentic_db?: KhoChung };
khoChung.__aescentic_db ??= {};
const chung = khoChung.__aescentic_db;

function chuoiKetNoi(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Thiếu DATABASE_URL. Xem aescentic-os/.env.example để biết cần đặt gì.",
    );
  }
  return url;
}

export function taoDb(url = chuoiKetNoi()) {
  const sql = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    // Supabase pooler không hỗ trợ prepared statement
    prepare: false,
    onnotice: () => {},
  });
  return Object.assign(drizzle(sql, { schema }), { $sql: sql });
}

/** Kết nối dùng chung cho tiến trình. Tạo lười, tái sử dụng. */
export function db(): Db {
  chung._db ??= taoDb();
  return chung._db;
}

/** Chỉ dùng trong test và script — đóng kết nối để tiến trình thoát được. */
export async function dongKetNoi(): Promise<void> {
  if (chung._db) await chung._db.$sql.end({ timeout: 5 });
  if (chung._sql) await chung._sql.end({ timeout: 5 });
  chung._db = null;
  chung._sql = null;
}
