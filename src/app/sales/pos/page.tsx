import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InventoryRow, Store, VariantFull } from "@/lib/sales/types";
import PosClient from "@/components/sales/PosClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const supabase = await createClient();
  const session = await getSessionProfile();

  const [{ data: stores }, { data: variants }, { data: inventory }] = await Promise.all([
    supabase.from("stores").select("*").eq("active", true).order("ma"),
    supabase
      .from("variants")
      .select("*, product:products(id, ten, dong_san_pham)")
      .eq("active", true)
      .order("sku"),
    supabase.from("inventory").select("*"),
  ]);

  return (
    <PosClient
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
      defaultStoreId={session?.profile?.store_id ?? null}
    />
  );
}
