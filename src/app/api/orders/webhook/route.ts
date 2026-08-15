import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type ItemIn = {
  sku?: string;
  variant_id?: string;
  so_luong?: number;
  don_gia?: number;
  ten_hien_thi?: string;
};

type OrderIn = {
  ma_don_san?: string;
  kenh?: string;
  store_ma?: string;
  khach_ten?: string;
  khach_sdt?: string;
  dia_chi?: string;
  phi_ship?: number;
  giam_gia?: number;
  thanh_toan?: string;
  ghi_chu?: string;
  ngay_dat?: string;
  trang_thai?: string;
  items?: ItemIn[];
};

/**
 * Nhận đơn từ website Aescentic.
 * Bảo vệ bằng header `x-webhook-secret` khớp env ORDER_WEBHOOK_SECRET.
 * Ghi bằng service role key (bỏ qua RLS) — KHÔNG bao giờ để lộ ra client.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ORDER_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !serviceKey || !url) {
    return NextResponse.json(
      { error: "Endpoint chưa bật — thiếu ORDER_WEBHOOK_SECRET / SUPABASE_SERVICE_ROLE_KEY" },
      { status: 501 },
    );
  }

  if (request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Sai secret" }, { status: 401 });
  }

  let body: OrderIn;
  try {
    body = (await request.json()) as OrderIn;
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ" }, { status: 400 });
  }

  const items = body.items ?? [];
  if (!items.length) {
    return NextResponse.json({ error: "Đơn không có sản phẩm" }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Kho ghi nhận: theo mã truyền lên, mặc định kho ONLINE
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("ma", body.store_ma ?? "ONLINE")
    .maybeSingle();

  if (!store) {
    return NextResponse.json(
      { error: `Không tìm thấy kho có mã ${body.store_ma ?? "ONLINE"}` },
      { status: 400 },
    );
  }

  const kenh = body.kenh ?? "website";

  // Chống ghi trùng khi website retry
  if (body.ma_don_san) {
    const { data: daCo } = await supabase
      .from("orders")
      .select("id, ma_don")
      .eq("kenh", kenh)
      .eq("ma_don_san", body.ma_don_san)
      .maybeSingle();
    if (daCo) {
      return NextResponse.json({ ok: true, trung: true, ...daCo });
    }
  }

  // Khớp SKU với danh mục để trừ kho đúng biến thể
  const skus = items.map((it) => it.sku).filter(Boolean) as string[];
  const { data: variants } = skus.length
    ? await supabase.from("variants").select("id, sku, ten_bien_the, gia_ban").in("sku", skus)
    : { data: [] };

  const bySku = new Map(
    (variants ?? []).map((v: { id: string; sku: string; ten_bien_the: string | null; gia_ban: number }) => [
      v.sku,
      v,
    ]),
  );

  const thieu = items.filter((it) => it.sku && !bySku.has(it.sku)).map((it) => it.sku);
  if (thieu.length) {
    return NextResponse.json({ error: `SKU chưa có trong danh mục: ${thieu.join(", ")}` }, { status: 400 });
  }

  const { data: orderId, error } = await supabase.rpc("tao_don_hang", {
    p_order: {
      kenh,
      store_id: store.id,
      khach_ten: body.khach_ten ?? "",
      khach_sdt: body.khach_sdt ?? "",
      dia_chi: body.dia_chi ?? "",
      thanh_toan: body.thanh_toan ?? "chua",
      giam_gia: body.giam_gia ?? 0,
      phi_ship: body.phi_ship ?? 0,
      ma_don_san: body.ma_don_san ?? "",
      ngay_dat: body.ngay_dat ?? new Date().toISOString(),
      ghi_chu: body.ghi_chu ?? "",
    },
    p_items: items.map((it) => {
      const v = it.sku ? bySku.get(it.sku) : null;
      return {
        variant_id: it.variant_id ?? v?.id ?? null,
        sku: it.sku ?? "",
        ten_hien_thi: it.ten_hien_thi ?? v?.ten_bien_the ?? it.sku ?? "",
        so_luong: it.so_luong ?? 1,
        don_gia: it.don_gia ?? v?.gia_ban ?? 0,
      };
    }),
    p_trang_thai: body.trang_thai ?? "moi",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: don } = await supabase
    .from("orders")
    .select("id, ma_don, tong_tien")
    .eq("id", orderId as string)
    .maybeSingle();

  return NextResponse.json({ ok: true, ...don });
}
