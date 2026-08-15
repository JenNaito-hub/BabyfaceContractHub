import { createClient } from "@/lib/supabase/server";
import type { Store, VariantFull } from "@/lib/sales/types";
import ImportClient from "@/components/sales/ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportOrdersPage() {
  const supabase = await createClient();

  const [{ data: stores }, { data: variants }] = await Promise.all([
    supabase.from("stores").select("*").eq("active", true).order("ma"),
    supabase
      .from("variants")
      .select("*, product:products(id, ten, dong_san_pham)")
      .order("sku"),
  ]);

  return (
    <ImportClient
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
    />
  );
}
