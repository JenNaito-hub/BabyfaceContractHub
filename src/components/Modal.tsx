"use client";

import { useEffect } from "react";

const SIZES = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export default function Modal({
  title,
  children,
  footer,
  onClose,
  size = "md",
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: keyof typeof SIZES;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-dark/50 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`my-auto w-full ${SIZES[size]} rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-dark/10 px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <button className="text-dark/40 hover:text-dark" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-dark/10 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
