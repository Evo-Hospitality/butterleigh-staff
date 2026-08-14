import { requireUser } from "@/lib/auth";
import { TaskForm } from "@/components/task-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import { createTaskAction } from "./actions";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireUser();
  const { error } = await searchParams;

  // Admin client — a task can be assigned to anyone, and a regular staff
  // member's own RLS-scoped session can only see themselves in profiles.
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>();
  const profiles = data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">New task</h1>
      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <TaskForm action={createTaskAction} profiles={profiles} currentUserId={user.id} submitLabel="Create task" />
    </div>
  );
}
