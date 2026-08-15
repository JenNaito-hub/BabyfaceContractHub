import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type { ReceiptItem, StockReceipt, Store, VariantFull } from "@/lib/sales/types";
import ReceiptsClient from "@/components/sales/ReceiptsClient";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const session = await getSessionProfile();
  if (!isManagerRole(session?.profile?.role)) redirect("/sales/inventory");

  const supabase = await createClient();
  const [{ data: receipts }, { data: items }, { data: stores }, { data: variants }] =
    await Promise.all([
      supabase.from("stock_receipts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("receipt_items").select("*"),
      supabase.from("stores").select("*").eq("active", true).order("ma"),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .eq("active", true)
        .order("sku"),
    ]);

  return (
    <ReceiptsClient
      receipts={(receipts ?? []) as StockReceipt[]}
      items={(items ?? []) as ReceiptItem[]}
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
    />
  );
}
