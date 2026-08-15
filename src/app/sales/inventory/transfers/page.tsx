import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type {
  InventoryRow,
  Store,
  Transfer,
  TransferItem,
  VariantFull,
} from "@/lib/sales/types";
import TransfersClient from "@/components/sales/TransfersClient";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const session = await getSessionProfile();
  if (!isManagerRole(session?.profile?.role)) redirect("/sales/inventory");

  const supabase = await createClient();
  const [{ data: transfers }, { data: items }, { data: stores }, { data: variants }, { data: inventory }] =
    await Promise.all([
      supabase.from("transfers").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("transfer_items").select("*"),
      supabase.from("stores").select("*").eq("active", true).order("ma"),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .eq("active", true)
        .order("sku"),
      supabase.from("inventory").select("*"),
    ]);

  return (
    <TransfersClient
      transfers={(transfers ?? []) as Transfer[]}
      items={(items ?? []) as TransferItem[]}
      stores={(stores ?? []) as Store[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
    />
  );
}
