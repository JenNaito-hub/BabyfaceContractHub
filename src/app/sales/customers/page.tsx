import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { isManagerRole } from "@/lib/types";
import type { Customer, Order } from "@/lib/sales/types";
import CustomersClient from "@/components/sales/CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createClient();
  const session = await getSessionProfile();

  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase
      .from("orders")
      .select("id, customer_id, tong_tien, trang_thai, ngay_dat, ma_don, kenh")
      .order("ngay_dat", { ascending: false })
      .limit(2000),
  ]);

  return (
    <CustomersClient
      customers={(customers ?? []) as Customer[]}
      orders={(orders ?? []) as Pick<
        Order,
        "id" | "customer_id" | "tong_tien" | "trang_thai" | "ngay_dat" | "ma_don" | "kenh"
      >[]}
      isManager={isManagerRole(session?.profile?.role)}
    />
  );
}
