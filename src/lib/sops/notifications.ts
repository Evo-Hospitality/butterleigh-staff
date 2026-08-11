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

// New questions deliberately don't email the admin/manager group — they
// show up in the "Unanswered questions" queue on /sops instead, which is
// enough without turning every question into a group email blast.
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
