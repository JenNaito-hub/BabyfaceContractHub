/**
 * Chạy migration SQL theo thứ tự tên file, ghi lại cái nào đã chạy.
 *
 * Nguyên tắc: chỉ tiến, không lùi. Mỗi file phải chạy được hai lần liên tiếp
 * không lỗi — kiểm tra bằng `npm run db:migrate` chạy hai lần.
 */
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const THU_MUC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export type KetQuaMigrate = {
  daChay: string[];
  boQua: string[];
  canhBao: string[];
};

export async function chayMigrations(
  databaseUrl = process.env.DATABASE_URL,
): Promise<KetQuaMigrate> {
  if (!databaseUrl) throw new Error("Thiếu DATABASE_URL");

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const kq: KetQuaMigrate = { daChay: [], boQua: [], canhBao: [] };

  try {
    await sql.unsafe(`
      create schema if not exists os;
      create table if not exists os.schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      );
    `);

    const daCo = new Map<string, string>(
      (
        await sql<{ name: string; checksum: string }[]>`
          select name, checksum from os.schema_migrations
        `
      ).map((r) => [r.name, r.checksum]),
    );

    const files = (await readdir(THU_MUC)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const noiDung = await readFile(path.join(THU_MUC, file), "utf8");
      const checksum = createHash("sha256").update(noiDung).digest("hex").slice(0, 16);
      const cu = daCo.get(file);

      if (cu) {
        if (cu !== checksum) {
          // Sửa migration đã chạy là nguồn lỗi âm thầm — phải hét lên.
          kq.canhBao.push(
            `${file} đã chạy trước đó nhưng nội dung đã đổi (${cu} → ${checksum}). ` +
              `Tạo migration mới thay vì sửa file cũ.`,
          );
        }
        kq.boQua.push(file);
        continue;
      }

      // Mỗi migration chạy trong một transaction: lỗi thì không để lại nửa vời.
      await sql.begin(async (tx) => {
        await tx.unsafe(noiDung);
        await tx`
          insert into os.schema_migrations (name, checksum) values (${file}, ${checksum})
        `;
      });
      kq.daChay.push(file);
    }

    return kq;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Chạy trực tiếp: npm run db:migrate
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  chayMigrations()
    .then((kq) => {
      for (const c of kq.canhBao) console.warn("⚠ " + c);
      console.log(
        kq.daChay.length ? `Đã chạy: ${kq.daChay.join(", ")}` : "Không có migration mới.",
      );
      if (kq.boQua.length) console.log(`Bỏ qua (đã chạy): ${kq.boQua.length} file`);
      process.exit(kq.canhBao.length ? 1 : 0);
    })
    .catch((e) => {
      console.error("Migration lỗi:", e.message);
      process.exit(1);
    });
}
