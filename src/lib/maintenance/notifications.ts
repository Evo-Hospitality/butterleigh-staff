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

// New request assigned to someone (either just created, or reassigned to
// them) — same "heads up" email either way.
export async function notifyMaintenanceAssigned(assigneeId: string, requestId: string, title: string, submittedByName: string) {
  const email = await emailFor(assigneeId);
  if (!email) return;

  await send(
    [email],
    `Maintenance: "${title}" assigned to you`,
    `<p><strong>${escapeHtml(submittedByName)}</strong> raised a maintenance issue now assigned to you: <strong>${escapeHtml(title)}</strong>.</p>
     <p><a href="${SITE_URL}/maintenance/${requestId}">View it</a></p>`,
  );
}

export async function notifyMaintenanceUpdate(
  submittedById: string,
  requestId: string,
  title: string,
  authorName: string,
  note: string,
) {
  const email = await emailFor(submittedById);
  if (!email) return;

  await send(
    [email],
    `Maintenance update: "${title}"`,
    `<p><strong>${escapeHtml(authorName)}</strong> added an update to your maintenance request <strong>${escapeHtml(title)}</strong>:</p>
     <p>${escapeHtml(note)}</p>
     <p><a href="${SITE_URL}/maintenance/${requestId}">View it</a></p>`,
  );
}
