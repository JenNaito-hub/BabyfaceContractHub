import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CastingWithTalent, Job, Talent } from "@/lib/types";
import JobDetailClient from "@/components/jobs/JobDetailClient";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: castings }, { data: talents }] = await Promise.all([
    supabase
      .from("castings")
      .select("*, talent:talents(id, ho_ten, status)")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("talents").select("id, ho_ten, status").order("ho_ten"),
  ]);

  return (
    <JobDetailClient
      job={job as Job}
      castings={(castings ?? []) as CastingWithTalent[]}
      talents={(talents ?? []) as Pick<Talent, "id" | "ho_ten" | "status">[]}
    />
  );
}
