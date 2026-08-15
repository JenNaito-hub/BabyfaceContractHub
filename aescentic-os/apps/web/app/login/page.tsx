import { redirect } from "next/navigation";
import { asc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, roles, userRoles, users } from "@aescentic/database";
import { devLoginDuocPhep, taoDevCookie, TEN_COOKIE } from "@aescentic/auth";
import { docPhien } from "@/lib/session";

export const dynamic = "force-dynamic";

async function dangNhapDev(formData: FormData) {
  "use server";
  if (!devLoginDuocPhep()) throw new Error("Dev login đã tắt");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const store = await cookies();
  store.set(TEN_COOKIE, taoDevCookie(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}

export default async function LoginPage() {
  if (await docPhien()) redirect("/");

  if (!devLoginDuocPhep()) {
    return (
      <main className="mx-auto max-w-md px-6 py-24">
        <h1 className="text-2xl font-extrabold">Aescentic OS</h1>
        <div className="card mt-6">
          <p className="text-sm text-muted">
            Đăng nhập qua Supabase Auth chưa được cấu hình cho môi trường này.
          </p>
          <p className="mt-3 text-sm">
            Cần <code className="bg-line px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            và khoá tương ứng. Xem <code className="bg-line px-1.5 py-0.5 font-mono text-xs">docs/integrations/credentials-needed.md</code>.
          </p>
        </div>
      </main>
    );
  }

  const database = db();
  const danhSach = await database
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      roleName: roles.name,
      roleCode: roles.code,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(isNull(users.archivedAt))
    .orderBy(asc(users.email));

  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        Môi trường phát triển
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Aescentic OS</h1>

      <div className="mt-4 border-l-[3px] border-danger bg-surface px-4 py-3">
        <p className="text-sm">
          Đây là <strong>đăng nhập giả lập chỉ dùng khi phát triển</strong>, không có mật
          khẩu. Nó tự tắt trên production và app sẽ không khởi động được nếu ai đó cố bật.
        </p>
      </div>

      <p className="mt-6 text-sm text-muted">
        Chọn một tài khoản để xem hệ thống dưới đúng quyền của vai trò đó.
      </p>

      <ul className="mt-4 divide-y divide-line border border-line bg-surface">
        {danhSach.map((u) => (
          <li key={`${u.id}-${u.roleCode ?? "none"}`}>
            <form action={dangNhapDev}>
              <input type="hidden" name="userId" value={u.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-ink/5"
              >
                <span>
                  <span className="block text-sm font-semibold">{u.fullName ?? u.email}</span>
                  <span className="block font-mono text-[11px] text-muted">{u.email}</span>
                </span>
                <span className="pill bg-line text-ink">{u.roleName ?? "chưa gán vai trò"}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
