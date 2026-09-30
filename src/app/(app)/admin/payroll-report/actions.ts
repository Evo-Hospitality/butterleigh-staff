"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

// Moves an approved holiday to another payroll month (or back to the normal
// rule with "auto"), via set_leave_pay_period() — admin-only, and it never
// touches the approval or the balance. See 0043_leave_pay_period_override.sql.
export async function setPayPeriodAction(requestId: string, returnTo: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const period = String(formData.get("period") ?? "");

  let year: number | null = null;
  let month: number | null = null;
  if (period !== "auto") {
    const match = /^(\d{4})-(\d{1,2})$/.exec(period);
    if (!match) {
      redirect(`${returnTo}&error=${encodeURIComponent("Choose a month to move it to.")}`);
    }
    year = Number(match[1]);
    month = Number(match[2]);
  }

  const { error } = await supabase.rpc("set_leave_pay_period", {
    p_request_id: requestId,
    p_year: year,
    p_month: month,
  });
  if (error) {
    redirect(`${returnTo}&error=${encodeURIComponent(error.message || "Couldn't move that holiday.")}`);
  }

  revalidatePath("/admin/payroll-report");
}
