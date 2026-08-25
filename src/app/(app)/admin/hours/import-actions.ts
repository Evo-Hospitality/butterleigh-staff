"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normaliseName, parseTimeEntries } from "@/lib/holiday/parse-time-entries";
import type { Profile } from "@/lib/types";
import { formatName } from "@/lib/name-case";

// How a single name in the file will be treated if committed as-is.
export type PreviewStatus = "post" | "salaried" | "unmatched";

export type PreviewLine = {
  rawName: string;
  displayName: string;
  hours: number;
  shifts: number;
  status: PreviewStatus;
  staffId: string | null;
  matchedName: string | null;
};

export type PreviewResult =
  | {
      ok: true;
      filename: string;
      periodStart: string | null;
      periodEnd: string | null;
      entryCount: number;
      lines: PreviewLine[];
    }
  | { ok: false; error: string };

// Reads the file and works out what would happen — writes nothing. The
// decision about which rows are real employees is made here, by a person,
// every time: the file always contains clock-ins that aren't staff and which
// ones vary, so this can't be a standing rule.
export async function previewTimeEntriesAction(formData: FormData): Promise<PreviewResult> {
  const { supabase } = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a TimeEntries CSV to review." };
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

  const lines: PreviewLine[] = parsed.totals.map((total) => {
    const match = byName.get(normaliseName(total.displayName));
    if (!match) {
      return { ...total, status: "unmatched", staffId: null, matchedName: null };
    }
    if (match.employment_type === "salaried") {
      return { ...total, status: "salaried", staffId: match.id, matchedName: match.full_name };
    }
    return { ...total, status: "post", staffId: match.id, matchedName: match.full_name };
  });

  return {
    ok: true,
    filename: file.name,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    entryCount: parsed.entryCount,
    lines,
  };
}

export type CommitLine = {
  displayName: string;
  rawName: string;
  hours: number;
  staffId: string | null;
  status: PreviewStatus;
};

export type CommitResult =
  | { ok: true; posted: number; skippedSalaried: number; unmatched: number; excluded: number }
  | { ok: false; error: string };

// Writes only what survived the review. Excluded rows are simply absent from
// `lines` — they leave no trace beyond the count, which is the point: they
// aren't staff, so there's nothing to follow up.
export async function commitTimeEntriesAction(payload: {
  year: number;
  month: number;
  filename: string;
  periodStart: string | null;
  periodEnd: string | null;
  entryCount: number;
  excluded: number;
  lines: CommitLine[];
}): Promise<CommitResult> {
  const { supabase, user, profile } = await requireAdmin();

  const { year, month, lines } = payload;
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { ok: false, error: "Missing the month to import into." };
  }
  if (lines.length === 0) {
    return { ok: false, error: "Every row was excluded — nothing to import." };
  }

  const toPost = lines.filter((l) => l.status === "post" && l.staffId);
  const unmatched = lines.filter((l) => l.status === "unmatched");
  const skippedSalaried = lines.filter((l) => l.status === "salaried").length;

  const { data: imported, error: importError } = await supabase
    .from("hours_imports")
    .insert({
      year,
      month,
      filename: payload.filename,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      entry_count: payload.entryCount,
      matched_count: toPost.length,
      skipped_salaried: skippedSalaried,
      excluded_count: payload.excluded,
      total_hours: toPost.reduce((sum, r) => sum + Number(r.hours), 0),
      imported_by: user.id,
      imported_by_name: profile.full_name,
    })
    .select()
    .single();

  if (importError || !imported) {
    return { ok: false, error: importError?.message ?? "Could not record the import." };
  }

  if (toPost.length > 0) {
    // The file is the whole period, so it replaces what's there for these
    // people. Deleting first hands ownership to this import, so removing it
    // takes these rows with it.
    await supabase
      .from("monthly_hours")
      .delete()
      .eq("year", year)
      .eq("month", month)
      .in("staff_id", toPost.map((r) => r.staffId as string));

    const { error: hoursError } = await supabase.from("monthly_hours").insert(
      toPost.map((r) => ({
        staff_id: r.staffId as string,
        year,
        month,
        hours_worked: Number(r.hours),
        entered_by: user.id,
        import_id: imported.id,
      })),
    );
    if (hoursError) {
      await supabase.from("hours_imports").delete().eq("id", imported.id);
      return { ok: false, error: hoursError.message };
    }
  }

  if (unmatched.length > 0) {
    await supabase.from("hours_import_unmatched").insert(
      unmatched.map((u) => ({
        import_id: imported.id,
        raw_name: u.rawName,
        display_name: u.displayName,
        hours: Number(u.hours),
      })),
    );
  }

  revalidatePath("/admin/hours");
  return {
    ok: true,
    posted: toPost.length,
    skippedSalaried,
    unmatched: unmatched.length,
    excluded: payload.excluded,
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

  // The import is the definitive source for how a name is spelled, but it
  // still gets cased consistently — the CSV writes some in block capitals.
  await supabase.from("profiles").update({ full_name: formatName(row.display_name) }).eq("id", profileId);

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

// Dismisses an outstanding name without posting anything — for a row that got
// through the review but turns out not to be an employee after all. Scoped to
// this import only; the same name will be reviewed again next time.
export async function dismissUnmatchedAction(unmatchedId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("hours_import_unmatched")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", unmatchedId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/admin/hours");
}

// After adding the missing people to Staff, re-runs matching for anything
// still outstanding on an import.
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
