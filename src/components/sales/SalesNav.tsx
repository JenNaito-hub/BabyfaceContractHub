"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { UserRole } from "@/lib/types";

const LINKS = [
  { href: "/sales", label: "Tổng quan", exact: true },
  { href: "/sales/pos", label: "Bán hàng" },
  { href: "/sales/orders", label: "Đơn hàng" },
  { href: "/sales/products", label: "Sản phẩm" },
  { href: "/sales/inventory", label: "Kho" },
  { href: "/sales/customers", label: "Khách hàng" },
  { href: "/sales/reports", label: "Báo cáo", managerOnly: true },
  { href: "/sales/settings", label: "Cài đặt", managerOnly: true },
];

export default function SalesNav({
  role,
  email,
  fullName,
  storeName,
}: {
  role: UserRole | null;
  email: string | null;
  fullName: string | null;
  storeName: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isManager = role === "admin" || role === "manager";
  const links = LINKS.filter((l) => !l.managerOnly || isManager);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-dark/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/sales" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-dark text-lg font-extrabold text-lime">
            Æ
          </span>
          <span className="hidden font-display text-sm font-extrabold sm:block">
            Aescentic Sales
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isActive(l.href, l.exact)
                  ? "bg-dark text-paper"
                  : "text-dark/70 hover:bg-dark/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold leading-tight">
              {fullName || email || "User"}
            </div>
            <div className="text-xs text-dark/50">
              {role ?? "—"}
              {storeName ? ` · ${storeName}` : ""}
            </div>
          </div>
          <form action="/auth/signout" method="post" className="hidden sm:block">
            <button type="submit" className="btn-ghost text-xs">
              Đăng xuất
            </button>
          </form>
          <button
            className="btn-ghost px-2 py-1 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="grid gap-1 border-t border-dark/10 px-4 py-3 lg:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                isActive(l.href, l.exact) ? "bg-dark text-paper" : "text-dark/70"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost mt-1 w-full text-xs">
              Đăng xuất
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
