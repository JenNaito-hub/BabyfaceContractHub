import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import { currentThang, khoangThang } from "@/lib/sales/calc";
import type {
  InventoryRow,
  Order,
  OrderItem,
  OrderItemCost,
  Store,
  VariantFull,
} from "@/lib/sales/types";
import DashboardClient from "@/components/sales/DashboardClient";

export const dynamic = "force-dynamic";

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>;
}) {
  const { thang: thangParam } = await searchParams;
  const thang = /^\d{4}-\d{2}$/.test(thangParam ?? "") ? thangParam! : currentThang();
  const { tu, den } = khoangThang(thang);

  const supabase = await createClient();
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);

  const [{ data: stores }, { data: orders }, { data: variants }, { data: inventory }] =
    await Promise.all([
      supabase.from("stores").select("*").order("ma"),
      supabase
        .from("orders")
        .select("*")
        .gte("ngay_dat", tu)
        .lt("ngay_dat", den)
        .order("ngay_dat", { ascending: false }),
      supabase
        .from("variants")
        .select("*, product:products(id, ten, dong_san_pham)")
        .eq("active", true),
      supabase.from("inventory").select("*"),
    ]);

  const orderIds = (orders ?? []).map((o: Order) => o.id);

  const [{ data: items }, { data: costs }] = await Promise.all([
    orderIds.length
      ? supabase.from("order_items").select("*").in("order_id", orderIds)
      : Promise.resolve({ data: [] as OrderItem[] }),
    isManager && orderIds.length
      ? supabase.from("order_item_costs").select("*").in("order_id", orderIds)
      : Promise.resolve({ data: [] as OrderItemCost[] }),
  ]);

  return (
    <DashboardClient
      thang={thang}
      isManager={isManager}
      stores={(stores ?? []) as Store[]}
      orders={(orders ?? []) as Order[]}
      items={(items ?? []) as OrderItem[]}
      costs={(costs ?? []) as OrderItemCost[]}
      variants={(variants ?? []) as VariantFull[]}
      inventory={(inventory ?? []) as InventoryRow[]}
    />
  );
}
