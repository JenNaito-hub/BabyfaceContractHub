import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type { InventoryRow, Order, Store, VariantFull } from "@/lib/sales/types";
import OrdersClient from "@/components/sales/OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const session = await getSessionProfile();

  const [{ data: orders }, { data: stores }, { data: variants }, { data: inventory }] =
    await Promise.all([
      supabase.from("orders").select("*").order("ngay_dat", { ascending: false }).limit(500),
      supabase.from("stores").select("*").order("ma"),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .eq("active", true)
        .order("sku"),
      supabase.from("inventory").select("*"),
    ]);

  return (
    <OrdersClient
      orders={(orders ?? []) as Order[]}
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
      defaultStoreId={session?.profile?.store_id ?? null}
      isManager={isManagerRole(session?.profile?.role)}
    />
  );
}
