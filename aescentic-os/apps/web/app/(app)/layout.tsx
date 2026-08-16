import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TEN_COOKIE } from "@aescentic/auth";
import { moTaQuyen } from "@aescentic/permissions";
import { docPhien } from "@/lib/session";
import { menuTheoQuyen } from "@/lib/menu";
import MenuChinh from "@/components/MenuChinh";

export const dynamic = "force-dynamic";

async function dangXuat() {
  "use server";
  (await cookies()).delete(TEN_COOKIE);
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await docPhien();
  if (!ctx) redirect("/login");

  // Menu dựng theo quyền thật, không hard-code theo tên vai trò. Sales, quản lý
  // cửa hàng và CEO cùng một giao diện mà thấy khác nhau.
  const nhom = menuTheoQuyen(ctx.principal);

  return (
    <div className="min-h-screen">
      <header className="relative border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-ink text-sm font-extrabold text-chip">
              Æ
            </span>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] sm:inline">
              Aescentic OS
            </span>
          </Link>

          <MenuChinh nhom={nhom} />

          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold leading-tight">
                {ctx.fullName ?? ctx.email}
              </div>
              <div className="font-mono text-[11px] text-muted">{moTaQuyen(ctx.principal)}</div>
            </div>
            <form action={dangXuat}>
              <button className="btn-ghost text-xs">Đăng xuất</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
