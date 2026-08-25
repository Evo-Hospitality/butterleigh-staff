"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { deleteStaff, sendStaffInvite, setTemporaryPassword, updateStaffEmail } from "@/lib/holiday/staff";
import { formatName } from "@/lib/name-case";
import { startImpersonation } from "@/lib/impersonation";

function fail(staffId: string, message: string): never {
  redirect(`/admin/staff/${staffId}?error=${encodeURIComponent(message)}`);
}

export async function updateStaffAction(staffId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const employmentType = String(formData.get("employment_type")) as "salaried" | "hourly";
  const workingDays = formData.getAll("working_days").map((d) => Number(d));
  const contractedHours = formData.get("contracted_hours_per_week");
  const allowance = formData.get("annual_allowance_days");
  const managerId = formData.get("manager_id");
  const startDate = formData.get("start_date");
  const newAllowanceDays = employmentType === "salaried" && allowance ? Number(allowance) : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: formatName(String(formData.get("full_name"))),
      role: String(formData.get("role")),
      employment_type: employmentType,
      working_days: workingDays,
      contracted_hours_per_week: contractedHours ? Number(contractedHours) : null,
      annual_allowance_days: newAllowanceDays,
      manager_id: managerId ? String(managerId) : null,
      is_manager: formData.get("is_manager") === "on",
      active: formData.get("active") === "on",
      start_date: startDate ? String(startDate) : null,
    })
    .eq("id", staffId);

  if (error) {
    fail(staffId, error.message);
  }

  // Keep this year's already-created balance row in sync with the profile
  // default — otherwise editing the allowance here silently does nothing
  // for anyone who already has a balance row for the current year (it'd
  // only apply the next time a balance row is freshly created).
  if (newAllowanceDays !== null) {
    await supabase
      .from("leave_balances")
      .update({ base_allowance: newAllowanceDays })
      .eq("staff_id", staffId)
      .eq("leave_year", new Date().getFullYear());
  }

  redirect("/admin/staff");
}

export async function deleteStaffAction(staffId: string) {
  const { user } = await requireAdmin();

  if (staffId === user.id) {
    fail(staffId, "You can't delete your own account.");
  }

  try {
    await deleteStaff(staffId);
  } catch (err) {
    fail(staffId, err instanceof Error ? err.message : "Failed to delete staff member.");
  }

  redirect("/admin/staff");
}

export async function sendInviteAction(staffId: string, email: string) {
  const { supabase } = await requireAdmin();

  await sendStaffInvite(email);
  await supabase.from("profiles").update({ invited_at: new Date().toISOString() }).eq("id", staffId);

  revalidatePath(`/admin/staff/${staffId}`);
}

export async function setTemporaryPasswordAction(staffId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const password = String(formData.get("password"));
  if (password.length < 8) {
    fail(staffId, "Password must be at least 8 characters.");
  }

  await setTemporaryPassword(staffId, password);
  await supabase
    .from("profiles")
    .update({ must_change_password: true, invited_at: new Date().toISOString() })
    .eq("id", staffId);

  revalidatePath(`/admin/staff/${staffId}`);
}

export async function setEmailAction(staffId: string, formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    fail(staffId, "Enter an email address.");
  }

  try {
    await updateStaffEmail(staffId, email);
  } catch (err) {
    fail(staffId, err instanceof Error ? err.message : "Failed to update email.");
  }

  revalidatePath(`/admin/staff/${staffId}`);
}

export async function startImpersonationAction(staffId: string) {
  try {
    await startImpersonation(staffId);
  } catch (err) {
    fail(staffId, err instanceof Error ? err.message : "Failed to start impersonation.");
  }

  redirect("/");
}
