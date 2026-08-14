"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { notifyTaskReviewNeeded, notifyTaskReviewed } from "@/lib/tasks/notifications";
import type { Task } from "@/lib/types";

function fail(id: string, message: string): never {
  redirect(`/tasks/${id}?error=${encodeURIComponent(message)}`);
}

export async function completeTaskAction(taskId: string) {
  const { supabase, profile } = await requireUser();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single<Task>();
  if (!task) {
    fail(taskId, "Task not found.");
  }

  const { error } = await supabase.rpc("complete_task", { p_task_id: taskId });
  if (error) {
    fail(taskId, error.message || "You don't have permission to complete this task.");
  }

  if (task.created_by) {
    await notifyTaskReviewNeeded(task.created_by, taskId, task.title, profile.full_name);
  }

  revalidatePath(`/tasks/${taskId}`);
}

export async function reviewTaskAction(taskId: string, outcome: "done" | "sent_back", formData: FormData) {
  const { supabase, profile } = await requireUser();
  const note = String(formData.get("note") ?? "").trim();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single<Task>();
  if (!task) {
    fail(taskId, "Task not found.");
  }

  const { error } = await supabase.rpc("review_task", {
    p_task_id: taskId,
    p_outcome: outcome,
    p_note: note || null,
  });
  if (error) {
    fail(taskId, error.message || "You don't have permission to review this task.");
  }

  if (task.assigned_to) {
    await notifyTaskReviewed(task.assigned_to, taskId, task.title, outcome, profile.full_name, note || null);
  }

  revalidatePath(`/tasks/${taskId}`);
}
