"use client";

import { TaskForm } from "@/components/task-form";
import { useMe } from "@/lib/client/me";
import { PageError } from "@/components/page-error";
import Loading from "../../loading";
import { useTasksView } from "../data";
import { createTaskAction } from "./actions";

export default function NewTaskPage() {
  const { user } = useMe()!;
  const view = useTasksView("newForm");
  if (!view.data) return <Loading />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">New task</h1>
      <PageError className="mb-4 max-w-lg" />
      <TaskForm action={createTaskAction} profiles={view.data.profiles} currentUserId={user.id} submitLabel="Create task" />
    </div>
  );
}
