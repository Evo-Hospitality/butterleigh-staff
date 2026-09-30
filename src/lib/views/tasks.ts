import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Task, TaskReview } from "@/lib/types";
import type { ViewMap } from "./types";

export type TaskHistoryRow = TaskReview & { tasks: { title: string } | null };
export type TaskAssignee = Pick<Profile, "id" | "full_name">;

// Admin client — a task can be assigned to anyone, and a regular staff
// member's own RLS-scoped session can only see themselves in profiles. Only
// names go to the browser, which is all the "Assign to" picker shows.
async function loadAssignees(): Promise<TaskAssignee[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("active", true)
    .order("full_name")
    .returns<TaskAssignee[]>();
  return data ?? [];
}

export const views = {
  // /tasks — every live, not-yet-done task (RLS scopes what each person sees).
  list: async () => {
    const { supabase } = await requireUser();
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("is_active", true)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .returns<Task[]>();
    return { tasks: tasks ?? [] };
  },

  // /tasks/history — tasks confirmed done since the start of this month.
  history: async () => {
    const { supabase } = await requireUser();
    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);

    const { data: reviews } = await supabase
      .from("task_reviews")
      .select("*, tasks(title)")
      .eq("outcome", "done")
      .gte("reviewed_at", monthStart.toISOString())
      .order("reviewed_at", { ascending: false })
      .returns<TaskHistoryRow[]>();
    return { reviews: reviews ?? [] };
  },

  // /tasks/new — the "Assign to" picker.
  newForm: async () => {
    await requireUser();
    return { profiles: await loadAssignees() };
  },

  // /tasks/[id] — the task and its review history.
  detail: async ({ id }) => {
    const { supabase } = await requireUser();
    if (!id) notFound();

    const [{ data: task }, { data: reviews }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).single<Task>(),
      supabase.from("task_reviews").select("*").eq("task_id", id).order("reviewed_at").returns<TaskReview[]>(),
    ]);
    if (!task) notFound();

    return { task, reviews: reviews ?? [] };
  },

  // /tasks/[id]/edit — creator or admin only.
  edit: async ({ id }) => {
    const { supabase, user, profile } = await requireUser();
    if (!id) notFound();

    const [{ data: task }, profiles] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).single<Task>(),
      loadAssignees(),
    ]);
    if (!task) notFound();
    if (task.created_by !== user.id && profile.role !== "admin") {
      redirect(`/tasks/${id}`);
    }

    return { task, profiles };
  },
} satisfies ViewMap;
