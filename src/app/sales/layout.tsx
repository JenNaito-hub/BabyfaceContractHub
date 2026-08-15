import { redirect } from "next/navigation";
import SalesNav from "@/components/sales/SalesNav";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  let storeName: string | null = null;
  if (session.profile?.store_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stores")
      .select("ten")
      .eq("id", session.profile.store_id)
      .maybeSingle();
    storeName = (data as { ten: string } | null)?.ten ?? null;
  }

  return (
    <div className="min-h-screen">
      <SalesNav
        role={session.profile?.role ?? null}
        email={session.email}
        fullName={session.profile?.full_name ?? null}
        storeName={storeName}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
