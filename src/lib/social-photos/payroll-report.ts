import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, SocialPhoto } from "@/lib/types";

export type SocialsPayrollRow = {
  staffId: string;
  fullName: string;
  pictureCount: number;
  amount: number;
};

function inMonth(isoTimestamp: string, year: number, month: number) {
  const d = new Date(isoTimestamp);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

// £1 per picture, hourly staff only (salaried staff aren't paid extra for
// this) — grouped by the month the "used" checkmark was set, not the month
// the photo was submitted. Employment type is checked against the staff
// member's CURRENT profile, not a snapshot from submission time, so this
// always reflects who's actually eligible for payroll right now.
export async function buildSocialsPayrollReport(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<SocialsPayrollRow[]> {
  const [{ data: photos }, { data: staff }] = await Promise.all([
    supabase.from("social_photos").select("*").eq("used_for_socials", true).returns<SocialPhoto[]>(),
    supabase.from("profiles").select("*").eq("active", true).eq("employment_type", "hourly").returns<Profile[]>(),
  ]);

  const hourlyIds = new Set((staff ?? []).map((s) => s.id));
  const nameById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  const countByStaff = new Map<string, number>();
  for (const photo of photos ?? []) {
    if (!photo.used_at || !photo.submitted_by) continue;
    if (!inMonth(photo.used_at, year, month)) continue;
    if (!hourlyIds.has(photo.submitted_by)) continue;
    countByStaff.set(photo.submitted_by, (countByStaff.get(photo.submitted_by) ?? 0) + 1);
  }

  return [...countByStaff.entries()]
    .map(([staffId, pictureCount]) => ({
      staffId,
      fullName: nameById.get(staffId) ?? "Unknown",
      pictureCount,
      amount: pictureCount,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function socialsPayrollReportToCsv(rows: SocialsPayrollRow[], year: number, month: number): string {
  const header = ["Staff", `Pictures used (${month}/${year})`, "Amount (£)"];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push([`"${row.fullName.replace(/"/g, '""')}"`, row.pictureCount, row.amount.toFixed(2)].join(","));
  }

  return lines.join("\n");
}
