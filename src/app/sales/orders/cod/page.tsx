import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/types";
import type { Order } from "@/lib/sales/types";
import CodClient from "@/components/sales/CodClient";

export const dynamic = "force-dynamic";

export default async function CodPage() {
  const session = await getSessionProfile();
  if (!isManagerRole(session?.profile?.role)) redirect("/sales/orders");

  const supabase = await createClient();

  // Chỉ cần các đơn có mã vận đơn — đối soát khớp theo mã này
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .not("ma_van_don", "is", null)
    .order("ngay_dat", { ascending: false })
    .limit(2000);

  return <CodClient orders={(orders ?? []) as Order[]} />;
}
