import { createClient } from "@/lib/supabase/server";
import type { Casting, Job } from "@/lib/types";
import LichClient from "@/components/lich/LichClient";

export const dynamic = "force-dynamic";

export default async function LichPage() {
  const supabase = await createClient();

  const [{ data: jobs }, { data: castings }, { data: talents }] = await Promise.all([
    supabase.from("jobs").select("*").order("ngay_bat_dau", { ascending: true }),
    supabase.from("castings").select("*"),
    supabase.from("talents").select("id, ho_ten"),
  ]);

  const talentNames: Record<string, string> = {};
  for (const t of (talents ?? []) as { id: string; ho_ten: string }[]) {
    talentNames[t.id] = t.ho_ten;
  }

  return (
    <LichClient
      jobs={(jobs ?? []) as Job[]}
      castings={(castings ?? []) as Casting[]}
      talentNames={talentNames}
    />
  );
}
