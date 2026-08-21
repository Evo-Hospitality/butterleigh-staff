import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { recurrenceLabel, isOverdue } from "@/lib/tasks/format";
import type { Task } from "@/lib/types";
import { formatDate } from "@/lib/format";

function TaskRow({ task }: { task: Task }) {
  const overdue = task.status === "pending" && isOverdue(task.due_date, task.due_time);
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="rounded-lg border border-border bg-background p-4 hover:border-accent"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-primary">{task.title}</p>
        {task.status === "awaiting_review" && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            Awaiting review
          </span>
        )}
        {overdue && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Overdue</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {task.created_by_name} → {task.assigned_to_name} · {recurrenceLabel(task.recurrence_unit, task.recurrence_value)}
        {task.due_date && ` · Due ${formatDate(task.due_date)}`}
      </p>
    </Link>
  );
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </div>
  );
}

export default async function TasksPage() {
  const { supabase, user } = await requireUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_active", true)
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .returns<Task[]>();

  const all = tasks ?? [];

  const needsAttention = all.filter(
    (t) =>
      (t.assigned_to === user.id && t.status === "pending") ||
      (t.created_by === user.id && t.status === "awaiting_review"),
  );

  const pending = all.filter((t) => t.status === "pending");
  const awaitingReview = all.filter((t) => t.status === "awaiting_review");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Tasks</h1>
        <div className="flex gap-2">
          <Link
            href="/tasks/history"
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            History
          </Link>
          <Link
            href="/tasks/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            New task
          </Link>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Needs your attention</h2>
      <div className="mb-8">
        <TaskList tasks={needsAttention} empty="Nothing needs your attention right now." />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Pending</h2>
      <div className="mb-8">
        <TaskList tasks={pending} empty="No pending tasks." />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Awaiting review</h2>
      <TaskList tasks={awaitingReview} empty="Nothing awaiting review." />
    </div>
  );
}
