"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function saveBalances(formData: FormData) {
  const { supabase } = await requireAdmin();

  const year = Number(formData.get("year"));
  const staffIds = new Set<string>();

  for (const key of formData.keys()) {
    if (key.startsWith("brought_") || key.startsWith("allowance_")) {
      staffIds.add(key.split("_").slice(1).join("_"));
    }
  }

  // Every row must have the same set of keys — Supabase batches a multi-row
  // upsert into a single INSERT, so a key missing on one row (e.g. hourly
  // staff have no allowance input) becomes NULL there rather than "use the
  // column default", which fails the whole batch against a NOT NULL column.
  const rows = Array.from(staffIds).map((staffId) => {
    const brought = formData.get(`brought_${staffId}`);
    const allowance = formData.get(`allowance_${staffId}`);
    return {
      staff_id: staffId,
      leave_year: year,
      brought_forward: brought === "" || brought === null ? 0 : Number(brought),
      base_allowance: allowance === null || allowance === "" ? 0 : Number(allowance),
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("leave_balances")
      .upsert(rows, { onConflict: "staff_id,leave_year" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/balances");
}
