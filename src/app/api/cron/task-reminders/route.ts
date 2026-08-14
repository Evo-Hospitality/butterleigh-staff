import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, NOTIFICATIONS_FROM_ADDRESS } from "@/lib/resend";
import { isOverdue } from "@/lib/tasks/format";
import type { Task } from "@/lib/types";

// Triggered by Vercel Cron (see vercel.json), once daily. Same
// CRON_SECRET-gated pattern as /api/cron/holiday-backup — fails closed if
// the secret isn't configured, since this would otherwise be a public,
// unauthenticated endpoint capable of spamming every assignee's inbox.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

  const { data: candidates } = await admin
    .from("tasks")
    .select("*")
    .eq("is_active", true)
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .not("due_date", "is", null)
    .returns<Task[]>();

  const overdue = (candidates ?? []).filter((t) => isOverdue(t.due_date, t.due_time));
  if (overdue.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const byAssignee = new Map<string, Task[]>();
  for (const task of overdue) {
    if (!task.assigned_to) continue;
    const list = byAssignee.get(task.assigned_to) ?? [];
    list.push(task);
    byAssignee.set(task.assigned_to, list);
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", [...byAssignee.keys()]);
  const emailByProfile = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const resend = createResendClient();
  let sentCount = 0;

  for (const [assigneeId, tasks] of byAssignee) {
    const email = emailByProfile.get(assigneeId);
    if (!email) continue;

    const subject = tasks.length === 1 ? `Overdue: ${tasks[0].title}` : `You have ${tasks.length} overdue tasks`;
    const items = tasks
      .map((t) => {
        const due = t.due_date
          ? ` (due ${t.due_date}${t.due_time ? ` at ${t.due_time.slice(0, 5)}` : ""})`
          : "";
        return `<li><a href="${SITE_URL}/tasks/${t.id}">${escapeHtml(t.title)}</a>${due}</li>`;
      })
      .join("");

    const { error } = await resend.emails.send({
      from: NOTIFICATIONS_FROM_ADDRESS,
      to: [email],
      subject,
      html: `<p>These tasks are overdue:</p><ul>${items}</ul>`,
    });

    if (!error) {
      sentCount += tasks.length;
      await admin
        .from("tasks")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", tasks.map((t) => t.id));
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount });
}
