import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { findScheduleConflicts } from "@/lib/calculations";
import type { Casting, CastingWithTalent, Job, Talent, TalentRating } from "@/lib/types";
import JobDetailClient from "@/components/jobs/JobDetailClient";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: castings }, { data: talents }, { data: allJobs }, { data: allCastings }, { data: ratings }] =
    await Promise.all([
      supabase
        .from("castings")
        .select("*, talent:talents(id, ho_ten, status)")
        .eq("job_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("talents")
        .select("id, ho_ten, status, is_blacklisted, ly_do_blacklist")
        .order("ho_ten"),
      supabase.from("jobs").select("*"),
      supabase.from("castings").select("*"),
      supabase.from("talent_ratings").select("*").eq("job_id", id),
    ]);

  // Talent nào của job này bị đặt trùng ngày với job khác
  const conflicts = findScheduleConflicts(
    (allJobs ?? []) as Job[],
    (allCastings ?? []) as Casting[],
  ).filter((c) => c.jobs.some((j) => j.id === id));

  const conflictByTalent: Record<string, { ngay: string; tenJobKhac: string[] }> = {};
  for (const c of conflicts) {
    const khac = c.jobs.filter((j) => j.id !== id).map((j) => j.ten_job);
    const cur = conflictByTalent[c.talentId];
    if (cur) cur.tenJobKhac = Array.from(new Set([...cur.tenJobKhac, ...khac]));
    else conflictByTalent[c.talentId] = { ngay: c.ngay, tenJobKhac: khac };
  }

  return (
    <JobDetailClient
      job={job as Job}
      castings={(castings ?? []) as CastingWithTalent[]}
      talents={
        (talents ?? []) as Pick<
          Talent,
          "id" | "ho_ten" | "status" | "is_blacklisted" | "ly_do_blacklist"
        >[]
      }
      ratings={(ratings ?? []) as TalentRating[]}
      conflictByTalent={conflictByTalent}
      currentUserId={session?.userId ?? null}
    />
  );
}
