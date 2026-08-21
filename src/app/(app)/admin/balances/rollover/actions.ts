"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export type RolloverLine = { staffId: string; opening: number; allowance: number };

// Writes next year's opening rows. Deliberately only sets brought_forward and
// base_allowance: an upsert leaves unlisted columns alone on conflict, so
// re-running never wipes accrued_hours or the used_* figures a part-finished
// year has already accumulated.
//
// This is also what makes January work at all — approve_leave_request()
// refuses outright when there's no leave_balances row for the year ("ask an
// admin to initialize it first"), so without a rollover the first approval
// of the new year fails for everyone.
export async function commitRolloverAction(toYear: number, linesJson: string) {
  const { supabase } = await requireAdmin();

  let lines: RolloverLine[];
  try {
    lines = JSON.parse(linesJson);
  } catch {
    throw new Error("Could not read the figures to roll over.");
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Nothing to roll over.");
  }

  const { error } = await supabase.from("leave_balances").upsert(
    lines.map((l) => ({
      staff_id: l.staffId,
      leave_year: toYear,
      brought_forward: Number(l.opening) || 0,
      base_allowance: Number(l.allowance) || 0,
    })),
    { onConflict: "staff_id,leave_year" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/balances");
  redirect(`/admin/balances?year=${toYear}&rolled=1`);
}
