/**
 * Kiểm tra kỷ luật kiến trúc bằng máy, không trông vào việc nhớ khi review.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function quetFile(thuMuc: string, duoi: string[]): Promise<string[]> {
  const ra: string[] = [];
  async function di(d: string) {
    let muc;
    try {
      muc = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const m of muc) {
      if (m.name === "node_modules" || m.name === ".next") continue;
      const p = path.join(d, m.name);
      if (m.isDirectory()) await di(p);
      else if (duoi.some((e) => m.name.endsWith(e))) ra.push(p);
    }
  }
  await di(thuMuc);
  return ra;
}

describe("kỷ luật kiến trúc", () => {
  test("mọi route handler đều đi qua withAuth", async () => {
    const routes = await quetFile(path.join(GOC, "apps", "web", "app", "api"), ["route.ts"]);
    assert.ok(routes.length > 0, "không tìm thấy route nào để kiểm — kiểm tra đường dẫn");

    const thieu: string[] = [];
    for (const f of routes) {
      const noiDung = await readFile(f, "utf8");
      const coExport = /export const (GET|POST|PUT|PATCH|DELETE)/.test(noiDung);
      if (coExport && !noiDung.includes("withAuth(")) {
        thieu.push(path.relative(GOC, f));
      }
    }

    assert.deepEqual(
      thieu,
      [],
      `Route sau thiếu withAuth — mỗi route phải khai báo quyền cần có:\n${thieu.join("\n")}`,
    );
  });

  test("packages/* không được import modules/*", async () => {
    // Bỏ file test: chúng chứa chính các chuỗi đang bị cấm, dưới dạng dữ liệu
    // chứ không phải import — nếu không, bài test này sẽ tự tố cáo chính nó.
    const files = (await quetFile(path.join(GOC, "packages"), [".ts"])).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    const pham: string[] = [];
    for (const f of files) {
      const noiDung = await readFile(f, "utf8");
      if (/from ["'](\.\.\/)*modules\//.test(noiDung) || noiDung.includes('from "@aescentic/modules')) {
        pham.push(path.relative(GOC, f));
      }
    }
    assert.deepEqual(pham, [], `Chiều phụ thuộc phải là apps → modules → packages:\n${pham.join("\n")}`);
  });

  test("packages/* không được import next hoặc react", async () => {
    const files = (await quetFile(path.join(GOC, "packages"), [".ts"])).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    const pham: string[] = [];
    for (const f of files) {
      const noiDung = await readFile(f, "utf8");
      if (/from ["'](next|react)(\/|["'])/.test(noiDung)) pham.push(path.relative(GOC, f));
    }
    assert.deepEqual(
      pham,
      [],
      `Domain logic phải độc lập framework để còn tách service được sau:\n${pham.join("\n")}`,
    );
  });

  test("không có secret nào lọt vào biến NEXT_PUBLIC_", async () => {
    const files = await quetFile(path.join(GOC, "apps"), [".ts", ".tsx"]);
    const pham: string[] = [];
    for (const f of files) {
      const noiDung = await readFile(f, "utf8");
      const khop = noiDung.match(/NEXT_PUBLIC_[A-Z_]*(SECRET|TOKEN|KEY)/g) ?? [];
      // Anon key của Supabase vốn là public, ngoại lệ duy nhất
      const xau = khop.filter((k) => !k.includes("ANON_KEY"));
      if (xau.length) pham.push(`${path.relative(GOC, f)}: ${xau.join(", ")}`);
    }
    assert.deepEqual(pham, [], `Secret không được prefix NEXT_PUBLIC_:\n${pham.join("\n")}`);
  });
});
