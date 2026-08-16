import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TEN_COOKIE } from "@aescentic/auth";
import { authorize, moTaQuyen } from "@aescentic/permissions";
import { docPhien } from "@/lib/session";

export const dynamic = "force-dynamic";

async function dangXuat() {
  "use server";
  (await cookies()).delete(TEN_COOKIE);
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await docPhien();
  if (!ctx) redirect("/login");

  // Menu dựng theo quyền thật, không hard-code theo tên vai trò
  const menu = [
    { href: "/", label: "Tổng quan", quyen: null },
    { href: "/pos", label: "Bán hàng", quyen: "order.create" },
    { href: "/orders", label: "Đơn hàng", quyen: "order.read" },
    { href: "/products", label: "Sản phẩm", quyen: "product.read" },
    { href: "/inventory", label: "Kho", quyen: "inventory.read" },
    { href: "/customers", label: "Khách hàng", quyen: "customer.read" },
    { href: "/cod", label: "Đối soát COD", quyen: "cod.read" },
    { href: "/stores", label: "Cửa hàng", quyen: "store.read" },
    { href: "/admin/users", label: "Người dùng", quyen: "user.manage" },
    { href: "/admin/roles", label: "Phân quyền", quyen: "role.manage" },
  ].filter((m) => !m.quyen || authorize(ctx.principal, m.quyen).allowed);

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-ink text-sm font-extrabold text-chip">
              Æ
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Aescentic OS</span>
          </Link>

          <nav className="flex flex-wrap gap-1">
            {menu.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="px-3 py-1.5 text-sm font-semibold text-ink/70 transition hover:bg-ink/5"
              >
                {m.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold leading-tight">
                {ctx.fullName ?? ctx.email}
              </div>
              <div className="font-mono text-[11px] text-muted">
                {moTaQuyen(ctx.principal)}
              </div>
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
