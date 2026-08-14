import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, NOTIFICATIONS_FROM_ADDRESS } from "@/lib/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// A notification failing to send should never block the underlying request
// action — the database mutation is already committed by the time this
// runs, so any error here is swallowed rather than surfaced.
async function send(to: string[], subject: string, html: string) {
  if (to.length === 0) return;
  try {
    const resend = createResendClient();
    await resend.emails.send({ from: NOTIFICATIONS_FROM_ADDRESS, to, subject, html });
  } catch {
    // best-effort only
  }
}

async function emailFor(profileId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
  return data?.email ?? null;
}

// New task assigned to someone else (not the creator themselves).
export async function notifyTaskAssigned(assigneeId: string, taskId: string, title: string, createdByName: string) {
  const email = await emailFor(assigneeId);
  if (!email) return;

  await send(
    [email],
    `Task assigned to you: "${title}"`,
    `<p><strong>${escapeHtml(createdByName)}</strong> assigned you a task: <strong>${escapeHtml(title)}</strong>.</p>
     <p><a href="${SITE_URL}/tasks/${taskId}">View it</a></p>`,
  );
}

// Assignee marked it complete — the creator needs to review it.
export async function notifyTaskReviewNeeded(creatorId: string, taskId: string, title: string, completedByName: string) {
  const email = await emailFor(creatorId);
  if (!email) return;

  await send(
    [email],
    `Ready for review: "${title}"`,
    `<p><strong>${escapeHtml(completedByName)}</strong> marked <strong>${escapeHtml(title)}</strong> as complete — it needs your review.</p>
     <p><a href="${SITE_URL}/tasks/${taskId}">Review it</a></p>`,
  );
}

// Creator reviewed it — either confirmed done or sent it back to the assignee.
export async function notifyTaskReviewed(
  assigneeId: string,
  taskId: string,
  title: string,
  outcome: "done" | "sent_back",
  reviewedByName: string,
  note: string | null,
) {
  const email = await emailFor(assigneeId);
  if (!email) return;

  const subject = outcome === "done" ? `Confirmed done: "${title}"` : `Sent back: "${title}"`;
  const summary =
    outcome === "done"
      ? `<strong>${escapeHtml(reviewedByName)}</strong> confirmed <strong>${escapeHtml(title)}</strong> as done.`
      : `<strong>${escapeHtml(reviewedByName)}</strong> sent <strong>${escapeHtml(title)}</strong> back — it needs more work.`;

  await send(
    [email],
    subject,
    `<p>${summary}</p>
     ${note ? `<p>${escapeHtml(note)}</p>` : ""}
     <p><a href="${SITE_URL}/tasks/${taskId}">View it</a></p>`,
  );
}
