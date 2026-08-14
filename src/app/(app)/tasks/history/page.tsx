import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { TaskReview } from "@/lib/types";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

type HistoryRow = TaskReview & { tasks: { title: string } | null };

function HistoryGroup({ title, items }: { title: string; items: HistoryRow[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-background">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>
                <Link href={`/tasks/${r.task_id}`} className="font-medium text-primary hover:text-accent">
                  {r.tasks?.title ?? "Deleted task"}
                </Link>
                <span className="ml-2 text-muted-foreground">
                  by {r.completed_by_name}, confirmed by {r.reviewed_by_name}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function TaskHistoryPage() {
  const { supabase } = await requireUser();

  const monthStart = startOfMonth(new Date());

  const { data: reviews } = await supabase
    .from("task_reviews")
    .select("*, tasks(title)")
    .eq("outcome", "done")
    .gte("reviewed_at", monthStart.toISOString())
    .order("reviewed_at", { ascending: false })
    .returns<HistoryRow[]>();

  const now = new Date();
  const weekStart = startOfWeek(now);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek: HistoryRow[] = [];
  const lastWeek: HistoryRow[] = [];
  const earlierThisMonth: HistoryRow[] = [];

  for (const r of reviews ?? []) {
    const at = new Date(r.reviewed_at);
    if (at >= weekStart) thisWeek.push(r);
    else if (at >= lastWeekStart) lastWeek.push(r);
    else earlierThisMonth.push(r);
  }

  return (
    <div>
      <Link href="/tasks" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Tasks
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-primary">Completed tasks</h1>
      <HistoryGroup title="This week" items={thisWeek} />
      <HistoryGroup title="Last week" items={lastWeek} />
      <HistoryGroup title="Earlier this month" items={earlierThisMonth} />
    </div>
  );
}
