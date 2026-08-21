"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { notifyTaskAssigned } from "@/lib/tasks/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDuplicateId, readSubmissionToken } from "@/lib/submission-token";

function fail(message: string): never {
  redirect(`/tasks/new?error=${encodeURIComponent(message)}`);
}

export async function createTaskAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const description = formData.get("description");
  const assignedToId = String(formData.get("assigned_to") ?? "").trim() || user.id;
  const dueDate = formData.get("due_date");
  const dueTime = formData.get("due_time");
  const recurrenceUnit = String(formData.get("recurrence_unit") ?? "").trim();
  const recurrenceValue = String(formData.get("recurrence_value") ?? "").trim();
  const submissionToken = readSubmissionToken(formData);

  if (!title) {
    fail("Give the task a title.");
  }

  // Admin client — profiles' own RLS only lets a regular staff member see
  // themselves, not the wider roster this needs (see lib/supabase/admin.ts
  // usage elsewhere for the same reasoning, freshly relearned this session).
  const admin = createAdminClient();
  const { data: assignee } = await admin.from("profiles").select("id, full_name").eq("id", assignedToId).single();
  if (!assignee) {
    fail("Could not find that person.");
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description ? String(description) : null,
      created_by: user.id,
      created_by_name: profile.full_name,
      assigned_to: assignee.id,
      assigned_to_name: assignee.full_name,
      due_date: dueDate ? String(dueDate) : null,
      due_time: dueTime ? String(dueTime) : null,
      recurrence_unit: recurrenceUnit || null,
      recurrence_value: recurrenceValue ? Number(recurrenceValue) : null,
      submission_token: submissionToken,
    })
    .select()
    .single();

  // Second press: the first already created it and emailed the assignee.
  const duplicateId = await findDuplicateId(supabase, "tasks", error, submissionToken);
  if (duplicateId) {
    redirect(`/tasks/${duplicateId}`);
  }

  if (error || !task) {
    fail(error?.message ?? "Failed to create this task.");
  }

  if (assignee.id !== user.id) {
    await notifyTaskAssigned(assignee.id, task.id, title, profile.full_name);
  }

  redirect(`/tasks/${task.id}`);
}
