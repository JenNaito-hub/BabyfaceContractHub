import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { isManagerRole, type Casting, type Talent } from "@/lib/types";
import DirectoryClient, { type TalentAggregate } from "@/components/directory/DirectoryClient";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);
  const supabase = await createClient();

  const [{ data: talents }, { data: castings }] = await Promise.all([
    supabase.from("talents").select("*").order("created_at", { ascending: false }),
    supabase
      .from("castings")
      .select("talent_id, job_id, ket_qua, so_tien_hd, chi_phi_ot"),
  ]);

  // Gộp số job + tổng tiền nhận theo talent
  const agg = new Map<string, TalentAggregate>();
  for (const c of (castings ?? []) as Pick<
    Casting,
    "talent_id" | "job_id" | "ket_qua" | "so_tien_hd" | "chi_phi_ot"
  >[]) {
    const cur = agg.get(c.talent_id) ?? { jobIds: new Set<string>(), tongTien: 0 };
    cur.jobIds.add(c.job_id);
    if (c.ket_qua === "Đậu") {
      cur.tongTien += Number(c.so_tien_hd ?? 0) + Number(c.chi_phi_ot ?? 0);
    }
    agg.set(c.talent_id, cur);
  }

  const aggregates: Record<string, { soJob: number; tongTien: number }> = {};
  for (const [id, v] of agg) {
    aggregates[id] = { soJob: v.jobIds.size, tongTien: v.tongTien };
  }

  return (
    <DirectoryClient
      talents={(talents ?? []) as Talent[]}
      aggregates={aggregates}
      isManager={isManager}
      currentUserId={session?.userId ?? null}
    />
  );
}
