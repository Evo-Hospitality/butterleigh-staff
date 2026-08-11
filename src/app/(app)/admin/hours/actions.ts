"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function saveMonthlyHours(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));

  const rows: { staff_id: string; year: number; month: number; hours_worked: number; entered_by: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("hours_")) continue;
    const hours = value === "" ? null : Number(value);
    if (hours === null) continue;
    rows.push({
      staff_id: key.replace("hours_", ""),
      year,
      month,
      hours_worked: hours,
      entered_by: user.id,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("monthly_hours")
      .upsert(rows, { onConflict: "staff_id,year,month" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/hours");
}
