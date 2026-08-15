import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type {
  InventoryRow,
  StockMove,
  Store,
  VariantCost,
  VariantFull,
} from "@/lib/sales/types";
import InventoryClient from "@/components/sales/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);

  const [{ data: stores }, { data: variants }, { data: inventory }, { data: moves }, { data: costs }] =
    await Promise.all([
      supabase.from("stores").select("*").eq("active", true).order("ma"),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .eq("active", true)
        .order("sku"),
      supabase.from("inventory").select("*"),
      supabase.from("stock_moves").select("*").order("created_at", { ascending: false }).limit(100),
      isManager
        ? supabase.from("variant_costs").select("*")
        : Promise.resolve({ data: [] as VariantCost[] }),
    ]);

  return (
    <InventoryClient
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
      moves={(moves ?? []) as StockMove[]}
      costs={(costs ?? []) as VariantCost[]}
      isManager={isManager}
    />
  );
}
