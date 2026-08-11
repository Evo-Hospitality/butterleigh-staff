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

// Only emails the submitter, on the decision — no group email to
// admins/managers when a new idea comes in, same lesson already applied to
// SOPs: the in-app Pending section is enough.
export async function notifySuggestionDecided(
  submittedById: string,
  suggestionId: string,
  title: string,
  status: "approved" | "declined",
  decidedByName: string,
  note: string | null,
) {
  const email = await emailFor(submittedById);
  if (!email) return;

  await send(
    [email],
    `Your event idea was ${status}: "${title}"`,
    `<p><strong>${escapeHtml(decidedByName)}</strong> ${status} your idea: <strong>${escapeHtml(title)}</strong>.</p>
     ${note ? `<p>${escapeHtml(note)}</p>` : ""}
     <p><a href="${SITE_URL}/events/${suggestionId}">View it</a></p>`,
  );
}
