import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { recurrenceLabel, isOverdue } from "@/lib/tasks/format";
import type { Task, TaskReview } from "@/lib/types";
import { completeTaskAction, reviewTaskAction } from "./actions";
import { formatDate, formatDateTime } from "@/lib/format";

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "done"
      ? "bg-green-100 text-green-800"
      : status === "awaiting_review"
        ? "bg-blue-100 text-blue-800"
        : "bg-yellow-100 text-yellow-800";
  const label = status === "awaiting_review" ? "Awaiting review" : status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>{label}</span>;
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireUser();

  const [{ data: task }, { data: reviews }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).single<Task>(),
    supabase
      .from("task_reviews")
      .select("*")
      .eq("task_id", id)
      .order("reviewed_at")
      .returns<TaskReview[]>(),
  ]);

  if (!task) {
    notFound();
  }

  const canComplete = (task.assigned_to === user.id || profile.role === "admin") && task.status === "pending";
  const canReview =
    (task.created_by === user.id || profile.role === "admin") && task.status === "awaiting_review";
  const canEdit = task.created_by === user.id || profile.role === "admin";

  const completeBound = completeTaskAction.bind(null, id);
  const confirmDoneBound = reviewTaskAction.bind(null, id, "done");
  const sendBackBound = reviewTaskAction.bind(null, id, "sent_back");

  const overdue = task.status === "pending" && isOverdue(task.due_date, task.due_time);

  return (
    <div>
      <Link href="/tasks" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Tasks
      </Link>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-primary">{task.title}</h1>
        <StatusBadge status={task.status} />
        {!task.is_active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Paused</span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Created by {task.created_by_name} · Assigned to {task.assigned_to_name} · {recurrenceLabel(task.recurrence_unit, task.recurrence_value)}
        {task.due_date && (
          <>
            {" "}
            · Due {formatDate(task.due_date)}
            {task.due_time && ` at ${task.due_time.slice(0, 5)}`}
            {overdue && <span className="text-red-700"> (overdue)</span>}
          </>
        )}
      </p>

      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {task.description && (
        <p className="mb-6 max-w-lg whitespace-pre-wrap text-sm">{task.description}</p>
      )}

      {canEdit && (
        <Link href={`/tasks/${id}/edit`} className="mb-6 inline-block text-sm font-medium text-accent hover:underline">
          Edit
        </Link>
      )}

      {canComplete && (
        <form action={completeBound} className="mb-8">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Mark complete
          </button>
        </form>
      )}

      {canReview && (
        <div className="mb-8 flex max-w-lg flex-col gap-3 rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-medium">
            {task.assigned_to_name} marked this complete — review it
          </p>
          <form action={confirmDoneBound} className="flex flex-col gap-2">
            <textarea
              name="note"
              rows={2}
              placeholder="Note (optional)"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Confirm done
              </button>
              <button
                type="submit"
                formAction={sendBackBound}
                className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:border-accent"
              >
                Send back
              </button>
            </div>
          </form>
        </div>
      )}

      {(reviews ?? []).length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-primary">History</h2>
          <div className="space-y-3">
            {(reviews ?? []).map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  {r.completed_by_name} completed it · {r.reviewed_by_name}{" "}
                  {r.outcome === "done" ? "confirmed done" : "sent it back"} ·{" "}
                  {formatDateTime(r.reviewed_at)}
                </p>
                {r.note && <p>{r.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
