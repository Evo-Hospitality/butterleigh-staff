import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { TaskForm } from "@/components/task-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Task } from "@/lib/types";
import { updateTaskAction } from "./actions";

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireUser();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single<Task>();
  if (!task) {
    notFound();
  }
  if (task.created_by !== user.id && profile.role !== "admin") {
    redirect(`/tasks/${id}`);
  }

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>();
  const profiles = data ?? [];

  const updateBound = updateTaskAction.bind(null, id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Edit task</h1>
      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <TaskForm action={updateBound} profiles={profiles} currentUserId={user.id} task={task} submitLabel="Save changes" />
    </div>
  );
}
