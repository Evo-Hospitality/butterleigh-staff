"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { deleteStaff, sendStaffInvite } from "@/lib/holiday/staff";

export async function updateStaffAction(staffId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const employmentType = String(formData.get("employment_type")) as "salaried" | "hourly";
  const workingDays = formData.getAll("working_days").map((d) => Number(d));
  const contractedHours = formData.get("contracted_hours_per_week");
  const allowance = formData.get("annual_allowance_days");
  const managerId = formData.get("manager_id");

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name")),
      role: String(formData.get("role")),
      employment_type: employmentType,
      working_days: workingDays,
      contracted_hours_per_week: contractedHours ? Number(contractedHours) : null,
      annual_allowance_days: employmentType === "salaried" && allowance ? Number(allowance) : null,
      manager_id: managerId ? String(managerId) : null,
      is_manager: formData.get("is_manager") === "on",
      active: formData.get("active") === "on",
    })
    .eq("id", staffId);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/staff");
}

export async function deleteStaffAction(staffId: string) {
  const { user } = await requireAdmin();

  if (staffId === user.id) {
    throw new Error("You can't delete your own account.");
  }

  await deleteStaff(staffId);
  redirect("/admin/staff");
}

export async function sendInviteAction(staffId: string, email: string) {
  const { supabase } = await requireAdmin();

  await sendStaffInvite(email);
  await supabase.from("profiles").update({ invited_at: new Date().toISOString() }).eq("id", staffId);

  revalidatePath(`/admin/staff/${staffId}`);
}
