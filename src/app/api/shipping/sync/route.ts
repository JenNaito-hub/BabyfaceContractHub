import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ghtkDaCauHinh, ghtkTrangThai } from "@/lib/shipping/ghtk";
import type { Order } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

/** Số đơn tra tối đa mỗi lần bấm — tránh treo request quá lâu. */
const GIOI_HAN = 40;

/**
 * Tra trạng thái các đơn đang trên đường ở GHTK và cập nhật lại hệ thống.
 * Chỉ đụng vào đơn có mã vận đơn và chưa kết thúc.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  if (!ghtkDaCauHinh()) {
    return NextResponse.json(
      { error: "Chưa bật GHTK — đặt biến môi trường GHTK_TOKEN rồi deploy lại" },
      { status: 501 },
    );
  }

  const { orderIds } = (await request.json().catch(() => ({}))) as { orderIds?: string[] };
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("*")
    .not("ma_van_don", "is", null)
    .eq("don_vi_van_chuyen", "GHTK");

  if (orderIds?.length) {
    query = query.in("id", orderIds);
  } else {
    query = query.in("trang_thai", ["da_xac_nhan", "dang_giao"]);
  }

  const { data: orders } = await query.order("ngay_dat", { ascending: false }).limit(GIOI_HAN);
  const list = (orders ?? []) as Order[];

  const ketQua = { tra: 0, doi: 0, loi: [] as string[] };

  for (const o of list) {
    try {
      const tt = await ghtkTrangThai(o.ma_van_don!);
      ketQua.tra += 1;

      const patch: Record<string, unknown> = {
        trang_thai_ship: tt.mo_ta,
        ship_cap_nhat_luc: new Date().toISOString(),
      };

      // Chỉ đổi trạng thái đơn khi hãng báo khác với hệ thống
      if (tt.trang_thai_noi_bo && tt.trang_thai_noi_bo !== o.trang_thai) {
        patch.trang_thai = tt.trang_thai_noi_bo;
        ketQua.doi += 1;
      }

      const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
      if (error) ketQua.loi.push(`${o.ma_don}: ${error.message}`);
    } catch (e) {
      ketQua.loi.push(`${o.ma_don}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, ...ketQua, tong: list.length });
}
