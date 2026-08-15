import { sql } from "drizzle-orm";
import { taoPosProvider } from "@aescentic/integrations";
import { withAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Tình trạng hệ thống cho admin: database sống không, tích hợp nào đang chạy
 * chế độ giả lập. Không bao giờ trả về giá trị credential.
 */
export const GET = withAuth("config.read", async (ctx) => {
  const batDau = Date.now();
  await ctx.db.execute(sql`select 1`);
  const dbMs = Date.now() - batDau;

  const pos = taoPosProvider();

  return Response.json({
    database: { ok: true, latencyMs: dbMs },
    integrations: {
      pos: { provider: pos.provider.name, laMock: pos.laMock, lyDo: pos.lyDo },
    },
    nguoiDung: { email: ctx.email, soQuyen: ctx.principal.permissions.length },
  });
});
