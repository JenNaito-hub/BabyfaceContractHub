import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, Store } from "@/lib/sales/types";
import PrintClient from "@/components/sales/PrintClient";

export const dynamic = "force-dynamic";

/**
 * Trang in dùng chung cho 1 hoặc nhiều đơn.
 *   /print/orders?ids=a,b,c&kieu=phieu   → phiếu giao hàng A5
 *   /print/orders?ids=a&kieu=hoadon      → hoá đơn bán lẻ khổ 80mm
 */
export default async function PrintOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; kieu?: string }>;
}) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const kieu = sp.kieu === "hoadon" ? "hoadon" : "phieu";

  if (!ids.length) {
    return <p className="p-8 text-sm text-dark/50">Thiếu tham số ?ids=</p>;
  }

  const supabase = await createClient();
  const [{ data: orders }, { data: items }, { data: stores }] = await Promise.all([
    supabase.from("orders").select("*").in("id", ids),
    supabase.from("order_items").select("*").in("order_id", ids).order("created_at"),
    supabase.from("stores").select("*"),
  ]);

  // Giữ đúng thứ tự người dùng chọn
  const byId = new Map(((orders ?? []) as Order[]).map((o) => [o.id, o]));
  const sorted = ids.map((id) => byId.get(id)).filter(Boolean) as Order[];

  return (
    <PrintClient
      kieu={kieu}
      orders={sorted}
      items={(items ?? []) as OrderItem[]}
      stores={(stores ?? []) as Store[]}
    />
  );
}
