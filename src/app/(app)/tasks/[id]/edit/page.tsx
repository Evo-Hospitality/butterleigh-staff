"use client";

import { useParams } from "next/navigation";
import { TaskForm } from "@/components/task-form";
import { useMe } from "@/lib/client/me";
import { PageError } from "@/components/page-error";
import Loading from "../../../loading";
import { useTasksView } from "../../data";
import { updateTaskAction } from "./actions";

export default function EditTaskPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useMe()!;
  const view = useTasksView("edit", { id });
  if (view.notFound) return <p className="text-sm text-muted-foreground">Task not found.</p>;
  if (!view.data) return <Loading />;

  const { task, profiles } = view.data;
  const updateBound = updateTaskAction.bind(null, id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Edit task</h1>
      <PageError className="mb-4 max-w-lg" />
      <TaskForm
        action={updateBound}
        profiles={profiles}
        currentUserId={user.id}
        task={task}
        submitLabel="Save changes"
      />
    </div>
  );
}
