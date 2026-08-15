import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { isManagerRole } from "@/lib/types";
import { ghtkKiemTra } from "@/lib/shipping/ghtk";

export const dynamic = "force-dynamic";

/** Bấm từ màn hình Cài đặt để biết token GHTK có dùng được không. */
export async function POST() {
  const session = await getSessionProfile();
  if (!isManagerRole(session?.profile?.role)) {
    return NextResponse.json({ error: "Chỉ quản lý được kiểm tra kết nối" }, { status: 403 });
  }

  const kq = await ghtkKiemTra();
  return NextResponse.json(kq, { status: kq.ok ? 200 : 400 });
}
