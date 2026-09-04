"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAppAccess } from "@/lib/auth";

// Admin only, matching the RLS policy in 0039. A recurring task is one row
// whose due date rolls forward, so this removes the whole series and its
// review history (task_reviews cascades) — not a single occurrence.
export async function deleteTaskAction(taskId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    redirect(`/tasks?error=${encodeURIComponent(error.message)}`);
  }

  // Same shape as deleteSubmittedStockTakeAction: the list is the right place
  // to land from either caller, and the task's own page has just ceased to
  // exist. The row disappearing is the confirmation.
  revalidatePath("/tasks");
  revalidatePath("/tasks/history");
  redirect("/tasks");
}

// Filed in the wrong app. Moves the whole record across (0040) rather than
// making someone re-key it, which would lose who raised it and when.
export async function moveTaskToActionAction(taskId: string) {
  const { supabase } = await requireAppAccess("tasks");

  const { data: newId, error } = await supabase.rpc("move_task_to_action", { p_task_id: taskId });
  if (error) {
    redirect(`/tasks?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/tasks");
  revalidatePath("/actions");
  redirect(`/actions/${newId}`);
}
