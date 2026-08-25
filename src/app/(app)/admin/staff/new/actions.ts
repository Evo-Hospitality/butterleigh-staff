"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createStaff, sendStaffInvite } from "@/lib/holiday/staff";

export async function createStaffAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const employmentType = String(formData.get("employment_type")) as "salaried" | "hourly";
  const workingDays = formData.getAll("working_days").map((d) => Number(d));
  const contractedHours = formData.get("contracted_hours_per_week");
  const allowance = formData.get("annual_allowance_days");
  const managerId = formData.get("manager_id");
  const email = String(formData.get("email"));
  const sendInviteNow = formData.get("send_invite_now") === "on";
  const startDate = formData.get("start_date");


  const user = await createStaff({
    email,
    fullName: String(formData.get("full_name")),
    role: String(formData.get("role")) as "staff" | "admin",
    employmentType,
    workingDays,
    contractedHoursPerWeek: contractedHours ? Number(contractedHours) : null,
    annualAllowanceDays: employmentType === "salaried" && allowance ? Number(allowance) : null,
    managerId: managerId ? String(managerId) : null,
    isManager: formData.get("is_manager") === "on",
  });

  // The handle_new_user() trigger doesn't read start_date (added after it
  // was written), so it's set here as a follow-up update instead.
  if (startDate) {
    await supabase
      .from("profiles")
      .update({
        ...(startDate ? { start_date: String(startDate) } : {}),
      })
      .eq("id", user.id);
  }

  if (sendInviteNow) {
    await sendStaffInvite(email);
    await supabase.from("profiles").update({ invited_at: new Date().toISOString() }).eq("id", user.id);
  }

  redirect("/admin/staff");
}
