"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

const LINKS = [
  { href: "/talent", label: "Dashboard", exact: true },
  { href: "/talent/jobs", label: "Jobs" },
  { href: "/talent/lich", label: "Lịch" },
  { href: "/talent/directory", label: "Talent" },
  { href: "/talent/thanh-toan", label: "Thanh toán" },
  { href: "/talent/approvals", label: "Duyệt", managerOnly: true },
  { href: "/talent/audit", label: "Audit", managerOnly: true },
];

export default function NavBar({
  role,
  email,
  fullName,
}: {
  role: UserRole | null;
  email: string | null;
  fullName: string | null;
}) {
  const pathname = usePathname();
  const isManager = role === "admin" || role === "manager";

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-dark/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/talent" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lime text-lg font-extrabold text-dark">
            B
          </span>
          <span className="hidden font-display text-sm font-extrabold sm:block">
            Talent Manager
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.filter((l) => !l.managerOnly || isManager).map((l) => (
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
            <div className="text-xs capitalize text-dark/50">{role ?? "—"}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost text-xs">
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
