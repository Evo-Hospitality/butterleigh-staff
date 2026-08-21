import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, NOTIFICATIONS_FROM_ADDRESS } from "@/lib/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function send(to: string[], subject: string, html: string) {
  if (to.length === 0) return;
  try {
    const resend = createResendClient();
    await resend.emails.send({ from: NOTIFICATIONS_FROM_ADDRESS, to, subject, html });
  } catch {
    // best-effort only — never block the submission itself
  }
}

async function adminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("email").eq("role", "admin").eq("active", true);
  return (data ?? []).map((p) => p.email).filter(Boolean);
}

async function emailFor(profileId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
  return data?.email ?? null;
}

// Group-emailing every admin is the anti-pattern avoided elsewhere in this
// app, but a new starter is blocked from doing anything at all until someone
// reviews them — and there are only a handful of admins.
export async function notifyOnboardingSubmitted(staffName: string) {
  await send(
    await adminEmails(),
    `New starter details to review: ${staffName}`,
    `<p><strong>${escapeHtml(staffName)}</strong> has submitted their employment details.</p>
     <p>They can't use the portal until it's approved.</p>
     <p><a href="${SITE_URL}/admin/onboarding">Review it</a></p>`,
  );
}

export async function notifyOnboardingDecided(
  staffId: string,
  approved: boolean,
  note: string | null,
) {
  const email = await emailFor(staffId);
  if (!email) return;

  await send(
    [email],
    approved ? "Your details have been approved" : "Your details need another look",
    approved
      ? `<p>Your employment details have been approved — you've now got full access to the staff portal.</p>
         <p><a href="${SITE_URL}">Open the portal</a></p>`
      : `<p>Thanks for sending your details over. Something needs correcting before we can approve them:</p>
         ${note ? `<p><em>${escapeHtml(note)}</em></p>` : ""}
         <p>Your answers are still there — just fix that bit and send it again.</p>
         <p><a href="${SITE_URL}/onboarding">Update your details</a></p>`,
  );
}

export async function notifyBankChangeRequested(staffName: string, staffPhone: string | null) {
  await send(
    await adminEmails(),
    `Bank details change requested: ${staffName}`,
    `<p><strong>${escapeHtml(staffName)}</strong> has asked to change their bank details.</p>
     <p><strong>Ring them before approving</strong>${staffPhone ? ` — ${escapeHtml(staffPhone)}` : ""}. A change of bank details
     is the usual shape of a payroll fraud, so confirm by voice that they really asked for it.</p>
     <p><a href="${SITE_URL}/admin/onboarding">Review it</a></p>`,
  );
}

export async function notifyBankChangeDecided(staffId: string, approved: boolean, note: string | null) {
  const email = await emailFor(staffId);
  if (!email) return;

  await send(
    [email],
    approved ? "Your bank details have been updated" : "Your bank details weren't changed",
    approved
      ? `<p>Your new bank details are now on file and will be used for your next payslip.</p>`
      : `<p>We haven't changed your bank details.</p>
         ${note ? `<p><em>${escapeHtml(note)}</em></p>` : ""}
         <p>If you didn't request this, tell a manager straight away.</p>`,
  );
}
