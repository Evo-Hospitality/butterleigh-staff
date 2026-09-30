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

// Only the designated reviewer gets emailed, and only once per submission —
// no group email, and no per-photo "your photo was used" follow-up (the
// reviewer may mark several photos in one sitting; that'd be exactly the
// notification-fatigue pattern already avoided elsewhere in this app).
// No-ops if no reviewer is configured yet.
export async function notifyPostSubmitted(
  reviewerId: string | null,
  postId: string,
  submitterName: string,
  photoCount: number,
) {
  if (!reviewerId) return;
  const email = await emailFor(reviewerId);
  if (!email) return;

  const plural = photoCount === 1 ? "photo" : "photos";
  await send(
    [email],
    `New social media photos from ${submitterName}`,
    `<p><strong>${escapeHtml(submitterName)}</strong> submitted ${photoCount} ${plural} for socials.</p>
     <p><a href="${SITE_URL}/social-photos">Review it</a></p>`,
  );
}

// One person per comment, never a group: the submitter hears when someone
// else comments on their photos; when the submitter replies, it goes to the
// reviewer instead (they're the one who'll have asked). Nobody is emailed
// about their own comment.
export async function notifyPostComment(
  recipientId: string | null,
  commenterId: string,
  commenterName: string,
  postCaption: string | null,
  body: string,
) {
  if (!recipientId || recipientId === commenterId) return;
  const email = await emailFor(recipientId);
  if (!email) return;

  const about = postCaption ? ` on “${escapeHtml(postCaption)}”` : "";
  await send(
    [email],
    `${commenterName} commented on social media photos`,
    `<p><strong>${escapeHtml(commenterName)}</strong> commented${about}:</p>
     <blockquote>${escapeHtml(body)}</blockquote>
     <p><a href="${SITE_URL}/social-photos">See the comment</a></p>`,
  );
}
