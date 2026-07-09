import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import JobsClient from "@/components/jobs/JobsClient";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const supabase = await createClient();

  const [{ data: jobs }, { data: castings }] = await Promise.all([
    supabase.from("jobs").select("*").order("thang", { ascending: false }),
    supabase.from("castings").select("job_id"),
  ]);

  const counts: Record<string, number> = {};
  for (const c of (castings ?? []) as { job_id: string }[]) {
    counts[c.job_id] = (counts[c.job_id] ?? 0) + 1;
  }

  return <JobsClient jobs={(jobs ?? []) as Job[]} castingCounts={counts} />;
}
