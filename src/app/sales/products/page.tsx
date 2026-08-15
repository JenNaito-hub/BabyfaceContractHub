import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type { InventoryRow, Product, VariantCost, VariantFull } from "@/lib/sales/types";
import ProductsClient from "@/components/sales/ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);

  const [{ data: products }, { data: variants }, { data: inventory }, { data: costs }] =
    await Promise.all([
      supabase.from("products").select("*").order("ten"),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .order("sku"),
      supabase.from("inventory").select("*"),
      isManager
        ? supabase.from("variant_costs").select("*")
        : Promise.resolve({ data: [] as VariantCost[] }),
    ]);

  return (
    <ProductsClient
      products={(products ?? []) as Product[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
      costs={(costs ?? []) as VariantCost[]}
      isManager={isManager}
    />
  );
}
