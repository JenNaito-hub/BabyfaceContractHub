import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Khai báo schema `os` để riêng một file.
 *
 * Nếu để trong index.ts thì sales.ts import ngược lại sẽ tạo vòng lặp: ESM đánh
 * giá module con TRƯỚC thân module cha, nên `os` chưa kịp khởi tạo.
 */
export const os = pgSchema("os");
