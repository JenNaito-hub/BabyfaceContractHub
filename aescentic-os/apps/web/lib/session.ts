import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users, type Db } from "@aescentic/database";
import { docDevCookie, loadPrincipal, TEN_COOKIE } from "@aescentic/auth";
import {
  authorize,
  PermissionDeniedError,
  requirePermission,
  type Decision,
  type Principal,
} from "@aescentic/permissions";

export type Ctx = {
  db: Db;
  principal: Principal;
  email: string;
  fullName: string | null;
};

/** Đọc phiên hiện tại. Trả null nếu chưa đăng nhập. */
export async function docPhien(): Promise<Ctx | null> {
  const store = await cookies();
  const userId = docDevCookie(store.get(TEN_COOKIE)?.value);
  if (!userId) return null;

  const database = db();
  const principal = await loadPrincipal(database, userId);
  if (!principal) return null;

  const [u] = await database
    .select({ email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;

  return { db: database, principal, email: u.email, fullName: u.fullName };
}

/**
 * Bọc route handler: bắt buộc đăng nhập + có quyền.
 *
 * MỌI route trong app/api phải đi qua đây. Có test kiểm tự động — quên thì CI đỏ,
 * không trông vào việc nhớ khi review.
 */
export function withAuth(
  permission: string,
  handler: (ctx: Ctx, decision: Decision, req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    const ctx = await docPhien();
    if (!ctx) {
      return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    try {
      const decision = requirePermission(ctx.principal, permission);
      return await handler(ctx, decision, req);
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        return Response.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }
  };
}

/**
 * Dùng trong server component: bắt buộc đăng nhập + có quyền.
 *
 * Thiếu quyền thì đưa sang trang giải thích, KHÔNG ném lỗi. Ném lỗi ở server
 * component sẽ ra trang "Something went wrong" kèm HTTP 500 — người dùng tưởng
 * hệ thống hỏng, còn giám sát thì báo động nhầm. Thiếu quyền là chuyện bình
 * thường, phải nói bằng tiếng người.
 */
export async function batBuocQuyen(
  permission: string,
): Promise<{ ctx: Ctx; decision: Decision }> {
  const ctx = await docPhien();
  if (!ctx) redirect("/login");

  const decision = authorize(ctx.principal, permission);
  if (!decision.allowed) redirect(`/khong-du-quyen?can=${encodeURIComponent(permission)}`);

  return { ctx, decision };
}

export { authorize };
