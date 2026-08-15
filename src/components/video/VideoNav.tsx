"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/video", label: "Tổng quan", exact: true },
  { href: "/video/editor", label: "Editor" },
  { href: "/video/showreel", label: "Showreel" },
  { href: "/video/script", label: "Kịch bản AI" },
  { href: "/video/production", label: "Sản xuất" },
  { href: "/video/talents", label: "Talent" },
  { href: "/video/media", label: "Thư viện" },
  { href: "/video/backup", label: "Sao lưu" },
];

export default function VideoNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-dark/10 bg-dark text-paper">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/video" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-sm font-extrabold text-dark">
            BV
          </span>
          <span className="font-display text-base font-bold tracking-tight">
            Video Studio
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isActive(l.href, l.exact)
                  ? "bg-lime text-dark"
                  : "text-paper/70 hover:bg-paper/10 hover:text-paper"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="ml-auto rounded-lg border border-paper/25 px-3 py-1.5 text-sm font-semibold md:hidden"
        >
          ☰
        </button>
      </div>

      {open && (
        <nav className="grid gap-1 border-t border-paper/10 px-4 pb-3 pt-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                isActive(l.href, l.exact) ? "bg-lime text-dark" : "text-paper/80"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
