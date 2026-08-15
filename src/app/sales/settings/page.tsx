import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole, type Profile } from "@/lib/types";
import type { Store } from "@/lib/sales/types";
import SettingsClient from "@/components/sales/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSessionProfile();
  if (!isManagerRole(session?.profile?.role)) redirect("/sales");

  const supabase = await createClient();
  const [{ data: stores }, { data: profiles }] = await Promise.all([
    supabase.from("stores").select("*").order("ma"),
    supabase.from("profiles").select("*").order("created_at"),
  ]);

  return (
    <SettingsClient
      stores={(stores ?? []) as Store[]}
      profiles={(profiles ?? []) as Profile[]}
      isAdmin={session?.profile?.role === "admin"}
    />
  );
}
