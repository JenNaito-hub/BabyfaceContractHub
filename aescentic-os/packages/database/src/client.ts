import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export type Db = ReturnType<typeof taoDb>;

let _sql: postgres.Sql | null = null;
let _db: Db | null = null;

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
  if (!_db) _db = taoDb();
  return _db;
}

/** Chỉ dùng trong test và script — đóng kết nối để tiến trình thoát được. */
export async function dongKetNoi(): Promise<void> {
  if (_db) await _db.$sql.end({ timeout: 5 });
  if (_sql) await _sql.end({ timeout: 5 });
  _db = null;
  _sql = null;
}
