"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NhomMenu } from "@/lib/menu";

/**
 * Thanh menu chính: 5–6 nhóm + "Thêm".
 *
 * Nhóm chỉ có một mục thì bấm thẳng vào mục đó, không bắt người dùng mở menu
 * rồi chọn một dòng duy nhất. Nhóm nhiều mục mới xổ xuống.
 */
export default function MenuChinh({ nhom }: { nhom: NhomMenu[] }) {
  const duongDan = usePathname();
  const [mo, setMo] = useState<string | null>(null);
  const [moDienThoai, setMoDienThoai] = useState(false);
  const boc = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài thì đóng menu đang xổ
  useEffect(() => {
    function ngoai(e: MouseEvent) {
      if (boc.current && !boc.current.contains(e.target as Node)) setMo(null);
    }
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, []);

  // Đổi trang thì đóng hết
  useEffect(() => {
    setMo(null);
    setMoDienThoai(false);
  }, [duongDan]);

  const chinh = nhom.filter((n) => !n.phu);
  const them = nhom.filter((n) => n.phu);

  function dangO(href: string) {
    const sach = href.split("?")[0]!;
    if (sach === "/") return duongDan === "/";
    return duongDan === sach || duongDan.startsWith(sach + "/");
  }

  function NhomMot({ n }: { n: NhomMenu }) {
    const mot = n.muc.length === 1 ? n.muc[0]! : null;
    const hoatDong = n.muc.some((m) => dangO(m.href));

    if (mot) {
      return (
        <Link
          href={mot.href}
          className={`px-3 py-1.5 text-sm font-semibold transition ${
            hoatDong ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          {n.nhan}
        </Link>
      );
    }

    return (
      <div className="relative">
        <button
          type="button"
          aria-expanded={mo === n.ma}
          onClick={() => setMo(mo === n.ma ? null : n.ma)}
          className={`px-3 py-1.5 text-sm font-semibold transition ${
            hoatDong ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          {n.nhan}
          <span className="ml-1 text-[10px] opacity-60">▾</span>
        </button>

        {mo === n.ma && (
          <div className="absolute left-0 top-full z-30 mt-1 w-[268px] border-2 border-ink bg-paper shadow-[4px_4px_0_0_rgba(20,24,16,0.12)]">
            {n.muc.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`block border-b border-line px-3 py-2 last:border-b-0 hover:bg-ink/5 ${
                  dangO(m.href) ? "bg-chip/40" : ""
                }`}
              >
                <div className="text-sm font-semibold">{m.nhan}</div>
                {m.mo && <div className="text-[11px] text-muted">{m.mo}</div>}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={boc} className="flex flex-1 items-center gap-1">
      {/* Điện thoại: một nút mở toàn bộ menu */}
      <button
        type="button"
        className="btn-ghost px-2 py-1 text-xs md:hidden"
        aria-expanded={moDienThoai}
        onClick={() => setMoDienThoai(!moDienThoai)}
      >
        ☰ Menu
      </button>

      <nav className="hidden flex-wrap items-center gap-1 md:flex">
        {chinh.map((n) => (
          <NhomMot key={n.ma} n={n} />
        ))}

        {them.length > 0 && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={mo === "them"}
              onClick={() => setMo(mo === "them" ? null : "them")}
              className="px-3 py-1.5 text-sm font-semibold text-ink/70 transition hover:bg-ink/5"
            >
              Thêm <span className="ml-1 text-[10px] opacity-60">▾</span>
            </button>
            {mo === "them" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-[268px] border-2 border-ink bg-paper shadow-[4px_4px_0_0_rgba(20,24,16,0.12)]">
                {them.flatMap((n) => n.muc).map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={`block border-b border-line px-3 py-2 last:border-b-0 hover:bg-ink/5 ${
                      dangO(m.href) ? "bg-chip/40" : ""
                    }`}
                  >
                    <div className="text-sm font-semibold">{m.nhan}</div>
                    {m.mo && <div className="text-[11px] text-muted">{m.mo}</div>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {moDienThoai && (
        <div className="absolute left-0 right-0 top-full z-30 border-b-2 border-ink bg-paper md:hidden">
          {nhom.map((n) => (
            <div key={n.ma} className="border-b border-line last:border-b-0">
              <div className="bg-surface px-4 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                {n.nhan}
              </div>
              {n.muc.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`block px-4 py-2.5 text-sm font-semibold ${
                    dangO(m.href) ? "bg-chip/40" : ""
                  }`}
                >
                  {m.nhan}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
