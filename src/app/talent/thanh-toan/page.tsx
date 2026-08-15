import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { isManagerRole, type CastingFull } from "@/lib/types";
import PaymentsClient from "@/components/payments/PaymentsClient";

export const dynamic = "force-dynamic";

export default async function ThanhToanPage() {
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);
  const supabase = await createClient();

  // Chỉ casting `Đậu` mới phát sinh chi trả cho talent.
  const { data: castings } = await supabase
    .from("castings")
    .select("*, talent:talents(id, ho_ten, status), job:jobs(*)")
    .eq("ket_qua", "Đậu")
    .order("created_at", { ascending: false });

  return (
    <PaymentsClient
      castings={(castings ?? []) as CastingFull[]}
      isManager={isManager}
      currentUserId={session?.userId ?? null}
    />
  );
}
