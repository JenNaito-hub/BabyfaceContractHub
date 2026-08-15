import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import { ngayLocal } from "@/lib/sales/calc";
import type { Order, OrderItem, OrderItemCost, Store } from "@/lib/sales/types";
import ReportsClient from "@/components/sales/ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string; den?: string }>;
}) {
  const session = await getSessionProfile();
  if (!isManagerRole(session?.profile?.role)) redirect("/sales");

  const sp = await searchParams;
  const homNay = new Date();
  const macDinhTu = new Date(homNay.getFullYear(), homNay.getMonth(), 1);

  const tu = /^\d{4}-\d{2}-\d{2}$/.test(sp.tu ?? "") ? sp.tu! : ngayLocal(macDinhTu);
  const den = /^\d{4}-\d{2}-\d{2}$/.test(sp.den ?? "") ? sp.den! : ngayLocal(homNay);

  // den là ngày cuối (bao gồm) → cộng 1 ngày để so sánh nửa mở
  const denExclusive = new Date(den + "T00:00:00");
  denExclusive.setDate(denExclusive.getDate() + 1);

  const supabase = await createClient();
  const [{ data: orders }, { data: stores }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .gte("ngay_dat", new Date(tu + "T00:00:00").toISOString())
      .lt("ngay_dat", denExclusive.toISOString())
      .order("ngay_dat", { ascending: false }),
    supabase.from("stores").select("*").order("ma"),
  ]);

  const ids = (orders ?? []).map((o: Order) => o.id);
  const [{ data: items }, { data: costs }] = await Promise.all([
    ids.length
      ? supabase.from("order_items").select("*").in("order_id", ids)
      : Promise.resolve({ data: [] as OrderItem[] }),
    ids.length
      ? supabase.from("order_item_costs").select("*").in("order_id", ids)
      : Promise.resolve({ data: [] as OrderItemCost[] }),
  ]);

  return (
    <ReportsClient
      tu={tu}
      den={den}
      orders={(orders ?? []) as Order[]}
      items={(items ?? []) as OrderItem[]}
      costs={(costs ?? []) as OrderItemCost[]}
      stores={(stores ?? []) as Store[]}
    />
  );
}
