"use client";

import { useEffect } from "react";

/** Nút điều khiển + tự mở hộp thoại in. Chỉ phần này là client. */
export default function InClient({ soLuong, kieu }: { soLuong: number; kieu: string }) {
  useEffect(() => {
    // Chờ font và ảnh xong rồi mới mở hộp thoại in, nếu không trang in ra bị
    // vỡ chữ.
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b-2 border-ink bg-paper px-4 py-3">
      <span className="text-sm font-semibold">
        {soLuong} {kieu === "hoadon" ? "hoá đơn" : "phiếu giao hàng"}
      </span>
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => window.history.back()}>
          Quay lại
        </button>
        <button className="btn-dark" onClick={() => window.print()}>
          In
        </button>
      </div>
    </div>
  );
}
