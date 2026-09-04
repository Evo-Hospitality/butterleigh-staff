"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/auth";

// The mirror of moveTaskToActionAction. Kept in its own file rather than
// [id]/actions.ts because the Actions list page needs it too, and that file
// is scoped to a single action's own operations.
export async function moveActionToTaskAction(actionId: string) {
  const { supabase } = await requireAppAccess("actions");

  const { data: newId, error } = await supabase.rpc("move_action_to_task", {
    p_action_id: actionId,
  });
  if (error) {
    redirect(`/actions?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/actions");
  revalidatePath("/tasks");
  redirect(`/tasks/${newId}`);
}
