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

async function adminAndManagerEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("active", true)
    .or("role.eq.admin,is_manager.eq.true");
  return (data ?? []).map((p) => p.email);
}

// New question asked — heads-up to the whole admin/manager pool, since it's
// a shared queue rather than routed to one person.
export async function notifySopQuestionAsked(entryId: string, title: string, askerName: string) {
  const emails = await adminAndManagerEmails();

  await send(
    emails,
    "New SOP question awaiting an answer",
    `<p><strong>${escapeHtml(askerName)}</strong> asked a question that needs an answer: <strong>${escapeHtml(title)}</strong>.</p>
     <p><a href="${SITE_URL}/sops/${entryId}">Answer it</a></p>`,
  );
}

export async function notifySopAnswered(askerId: string, entryId: string, title: string, answeredByName: string) {
  const email = await emailFor(askerId);
  if (!email) return;

  await send(
    [email],
    `Your question has been answered: "${title}"`,
    `<p><strong>${escapeHtml(answeredByName)}</strong> answered your question: <strong>${escapeHtml(title)}</strong>.</p>
     <p><a href="${SITE_URL}/sops/${entryId}">View the answer</a></p>`,
  );
}
