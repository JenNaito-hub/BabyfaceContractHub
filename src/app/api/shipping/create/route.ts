import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ghtkDaCauHinh, ghtkTaoVanDon } from "@/lib/shipping/ghtk";
import type { Order, OrderItem, Store, VariantFull } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

/** Đẩy 1 đơn sang hãng vận chuyển và lưu mã vận đơn về đơn. */
export async function POST(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  if (!ghtkDaCauHinh()) {
    return NextResponse.json(
      { error: "Chưa bật GHTK — đặt biến môi trường GHTK_TOKEN rồi deploy lại" },
      { status: 501 },
    );
  }

  const { orderId } = (await request.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "Thiếu orderId" }, { status: 400 });

  // Đọc bằng session của người dùng → RLS vẫn áp dụng
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });

  const o = order as Order;
  if (o.ma_van_don) {
    return NextResponse.json(
      { error: `Đơn đã có mã vận đơn ${o.ma_van_don}. Huỷ mã cũ trước khi tạo mới.` },
      { status: 400 },
    );
  }

  const [{ data: items }, { data: store }, { data: variants }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", orderId),
    supabase.from("stores").select("*").eq("id", o.store_id).maybeSingle(),
    supabase.from("variants").select("*, product:products(id, ten, dong_san_pham)"),
  ]);

  if (!items?.length) {
    return NextResponse.json({ error: "Đơn chưa có sản phẩm" }, { status: 400 });
  }
  if (!store) {
    return NextResponse.json({ error: "Không tìm thấy cửa hàng xuất hàng" }, { status: 400 });
  }

  const variantMap = new Map(
    ((variants ?? []) as VariantFull[]).map((v) => [v.id, v]),
  );

  try {
    const kq = await ghtkTaoVanDon(o, items as OrderItem[], store as Store, variantMap);

    const { error } = await supabase
      .from("orders")
      .update({
        ma_van_don: kq.ma_van_don,
        don_vi_van_chuyen: "GHTK",
        // Chỉ ghi đè phí ship nếu shop chưa tự nhập
        phi_ship: o.phi_ship > 0 ? o.phi_ship : kq.phi_ship,
        trang_thai_ship: "Đã tạo vận đơn",
        ship_cap_nhat_luc: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      return NextResponse.json(
        { error: `Đã tạo vận đơn ${kq.ma_van_don} nhưng lưu vào đơn lỗi: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ...kq });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
