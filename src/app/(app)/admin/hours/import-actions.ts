"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normaliseName, parseTimeEntries } from "@/lib/holiday/parse-time-entries";
import type { Profile } from "@/lib/types";

export type ImportResult =
  | { ok: true; importId: string; posted: number; skippedSalaried: number; unmatched: number }
  | { ok: false; error: string };

// Posts hours for the staff we can match, records the ones we can't, and
// never lets the second stop the first — a couple of unrecognised names
// shouldn't hold up a payroll run.
export async function importTimeEntriesAction(formData: FormData): Promise<ImportResult> {
  const { supabase, user, profile } = await requireAdmin();

  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a TimeEntries CSV to import." };
  }
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { ok: false, error: "Missing the month to import into." };
  }

  let parsed;
  try {
    parsed = parseTimeEntries(await file.text());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
  }
  if (parsed.totals.length === 0) {
    return { ok: false, error: "No time entries found in that file." };
  }

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .returns<Profile[]>();
  const byName = new Map((staff ?? []).map((s) => [normaliseName(s.full_name), s]));

  const toPost: { staffId: string; hours: number }[] = [];
  const unmatched: { raw_name: string; display_name: string; hours: number }[] = [];
  let skippedSalaried = 0;

  for (const total of parsed.totals) {
    const match = byName.get(normaliseName(total.displayName));
    if (!match) {
      unmatched.push({ raw_name: total.rawName, display_name: total.displayName, hours: total.hours });
      continue;
    }
    if (match.employment_type === "salaried") {
      skippedSalaried++;
      continue;
    }
    toPost.push({ staffId: match.id, hours: total.hours });
  }

  const { data: imported, error: importError } = await supabase
    .from("hours_imports")
    .insert({
      year,
      month,
      filename: file.name,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      entry_count: parsed.entryCount,
      matched_count: toPost.length,
      skipped_salaried: skippedSalaried,
      total_hours: toPost.reduce((sum, r) => sum + r.hours, 0),
      imported_by: user.id,
      imported_by_name: profile.full_name,
    })
    .select()
    .single();

  if (importError || !imported) {
    return { ok: false, error: importError?.message ?? "Could not record the import." };
  }

  if (toPost.length > 0) {
    // Replace whatever's there for these people this month — the file is the
    // whole period, so it's the truth. Deleting first (rather than upserting)
    // hands ownership to this import, so removing it takes these rows with it.
    await supabase
      .from("monthly_hours")
      .delete()
      .eq("year", year)
      .eq("month", month)
      .in("staff_id", toPost.map((r) => r.staffId));

    const { error: hoursError } = await supabase.from("monthly_hours").insert(
      toPost.map((r) => ({
        staff_id: r.staffId,
        year,
        month,
        hours_worked: r.hours,
        entered_by: user.id,
        import_id: imported.id,
      })),
    );
    if (hoursError) {
      // Roll the import back rather than leaving a half-applied one behind.
      await supabase.from("hours_imports").delete().eq("id", imported.id);
      return { ok: false, error: hoursError.message };
    }
  }

  if (unmatched.length > 0) {
    await supabase
      .from("hours_import_unmatched")
      .insert(unmatched.map((u) => ({ ...u, import_id: imported.id })));
  }

  revalidatePath("/admin/hours");
  return {
    ok: true,
    importId: imported.id,
    posted: toPost.length,
    skippedSalaried,
    unmatched: unmatched.length,
  };
}

// Deleting cascades to its monthly_hours rows, and the recalc trigger fires
// per deleted row, so holiday accrual unwinds with it.
export async function deleteHoursImportAction(importId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("hours_imports").delete().eq("id", importId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/admin/hours");
}

// Points an unrecognised name at an existing staff member. The time system is
// the definitive spelling, so this renames the staff record to match — the
// same name won't come up unmatched next month.
export async function linkUnmatchedAction(unmatchedId: string, profileId: string) {
  const { supabase, user } = await requireAdmin();

  const { data: row } = await supabase
    .from("hours_import_unmatched")
    .select("*, hours_imports(year, month)")
    .eq("id", unmatchedId)
    .single<{
      id: string;
      import_id: string;
      display_name: string;
      hours: number;
      hours_imports: { year: number; month: number } | null;
    }>();

  if (!row || !row.hours_imports) {
    throw new Error("That unmatched entry no longer exists.");
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single<Profile>();
  if (!target) {
    throw new Error("Could not find that staff member.");
  }

  await supabase.from("profiles").update({ full_name: row.display_name }).eq("id", profileId);

  // Salaried staff are matched but never posted, same rule as the import.
  if (target.employment_type !== "salaried") {
    const { year, month } = row.hours_imports;
    await supabase.from("monthly_hours").delete().eq("year", year).eq("month", month).eq("staff_id", profileId);
    await supabase.from("monthly_hours").insert({
      staff_id: profileId,
      year,
      month,
      hours_worked: row.hours,
      entered_by: user.id,
      import_id: row.import_id,
    });
  }

  await supabase
    .from("hours_import_unmatched")
    .update({ resolved_profile_id: profileId, resolved_at: new Date().toISOString() })
    .eq("id", unmatchedId);

  revalidatePath("/admin/hours");
}

// After adding the missing people to Staff, re-runs matching for anything
// still outstanding on an import — so several new starters are picked up in
// one go rather than one at a time.
export async function recheckUnmatchedAction(importId: string) {
  const { supabase, user } = await requireAdmin();

  const { data: outstanding } = await supabase
    .from("hours_import_unmatched")
    .select("*")
    .eq("import_id", importId)
    .is("resolved_at", null);

  const { data: imported } = await supabase
    .from("hours_imports")
    .select("year, month")
    .eq("id", importId)
    .single<{ year: number; month: number }>();

  if (!outstanding?.length || !imported) {
    revalidatePath("/admin/hours");
    return;
  }

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .returns<Profile[]>();
  const byName = new Map((staff ?? []).map((s) => [normaliseName(s.full_name), s]));

  for (const row of outstanding) {
    const match = byName.get(normaliseName(row.display_name));
    if (!match) continue;

    if (match.employment_type !== "salaried") {
      await supabase
        .from("monthly_hours")
        .delete()
        .eq("year", imported.year)
        .eq("month", imported.month)
        .eq("staff_id", match.id);
      await supabase.from("monthly_hours").insert({
        staff_id: match.id,
        year: imported.year,
        month: imported.month,
        hours_worked: row.hours,
        entered_by: user.id,
        import_id: importId,
      });
    }

    await supabase
      .from("hours_import_unmatched")
      .update({ resolved_profile_id: match.id, resolved_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  revalidatePath("/admin/hours");
}
