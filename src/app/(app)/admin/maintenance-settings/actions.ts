"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function saveMaintenanceSettingsAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const assigneeId = formData.get("default_maintenance_assignee_id");

  const { error } = await supabase
    .from("settings")
    .update({ default_maintenance_assignee_id: assigneeId ? String(assigneeId) : null })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/maintenance-settings");
}
