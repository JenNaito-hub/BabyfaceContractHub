import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type {
  InventoryRow,
  Order,
  OrderItem,
  OrderItemCost,
  Store,
  VariantFull,
} from "@/lib/sales/types";
import OrderDetailClient from "@/components/sales/OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: stores }, { data: variants }, { data: inventory }, { data: costs }] =
    await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
      supabase.from("stores").select("*").order("ma"),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .eq("active", true)
        .order("sku"),
      supabase.from("inventory").select("*"),
      isManager
        ? supabase.from("order_item_costs").select("*").eq("order_id", id)
        : Promise.resolve({ data: [] as OrderItemCost[] }),
    ]);

  return (
    <OrderDetailClient
      order={order as Order}
      items={(items ?? []) as OrderItem[]}
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
      costs={(costs ?? []) as OrderItemCost[]}
      isManager={isManager}
    />
  );
}
