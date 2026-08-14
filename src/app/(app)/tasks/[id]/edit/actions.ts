"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(id: string, message: string): never {
  redirect(`/tasks/${id}/edit?error=${encodeURIComponent(message)}`);
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  const { supabase } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const description = formData.get("description");
  const assignedToId = String(formData.get("assigned_to") ?? "").trim();
  const dueDate = formData.get("due_date");
  const dueTime = formData.get("due_time");
  const recurrenceUnit = String(formData.get("recurrence_unit") ?? "").trim();
  const recurrenceValue = String(formData.get("recurrence_value") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!title) {
    fail(taskId, "Give the task a title.");
  }
  if (!assignedToId) {
    fail(taskId, "Choose who this is assigned to.");
  }

  // Admin client — same reasoning as new/actions.ts: a regular staff
  // member's own RLS-scoped session can't read an arbitrary other
  // person's profile.
  const admin = createAdminClient();
  const { data: assignee } = await admin.from("profiles").select("id, full_name").eq("id", assignedToId).single();
  if (!assignee) {
    fail(taskId, "Could not find that person.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description: description ? String(description) : null,
      assigned_to: assignee.id,
      assigned_to_name: assignee.full_name,
      due_date: dueDate ? String(dueDate) : null,
      due_time: dueTime ? String(dueTime) : null,
      recurrence_unit: recurrenceUnit || null,
      recurrence_value: recurrenceValue ? Number(recurrenceValue) : null,
      is_active: isActive,
    })
    .eq("id", taskId);

  if (error) {
    fail(taskId, "You don't have permission to edit this task.");
  }

  redirect(`/tasks/${taskId}`);
}
