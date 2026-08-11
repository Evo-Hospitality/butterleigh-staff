import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, NOTIFICATIONS_FROM_ADDRESS } from "@/lib/resend";
import type { Profile } from "@/lib/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// A notification failing to send should never block the underlying
// request/approval — the database mutation is already committed by the
// time this runs, so any error here is swallowed rather than surfaced.
async function send(to: string[], subject: string, html: string) {
  if (to.length === 0) return;
  try {
    const resend = createResendClient();
    await resend.emails.send({ from: NOTIFICATIONS_FROM_ADDRESS, to, subject, html });
  } catch {
    // best-effort only
  }
}

// Direct manager if they have one; otherwise every admin (the fallback
// approver for anyone at the top of the chain) — mirrors the routing logic
// in approve_leave_request/approve_lieu_request.
async function getApproverEmails(staffProfile: Profile, admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  if (staffProfile.manager_id) {
    const { data: manager } = await admin.from("profiles").select("email").eq("id", staffProfile.manager_id).single();
    return manager ? [manager.email] : [];
  }
  const { data: admins } = await admin.from("profiles").select("email").eq("role", "admin").eq("active", true);
  return (admins ?? []).map((a) => a.email);
}

export async function notifyNewLeaveRequest(staffProfile: Profile, startDate: string, endDate: string, amount: number) {
  const admin = createAdminClient();
  const to = await getApproverEmails(staffProfile, admin);
  const unit = staffProfile.employment_type === "hourly" ? "hours" : "days";
  await send(
    to,
    `Holiday request from ${staffProfile.full_name} needs approval`,
    `<p><strong>${escapeHtml(staffProfile.full_name)}</strong> has requested holiday from ${startDate} to ${endDate} (${amount} ${unit}).</p>
     <p><a href="${SITE_URL}/holiday/approvals">Review it</a></p>`,
  );
}

export async function notifyNewLieuRequest(staffProfile: Profile, workDate: string) {
  const admin = createAdminClient();
  const to = await getApproverEmails(staffProfile, admin);
  await send(
    to,
    `Day-in-lieu request from ${staffProfile.full_name} needs approval`,
    `<p><strong>${escapeHtml(staffProfile.full_name)}</strong> has requested a day in lieu for working ${workDate}.</p>
     <p><a href="${SITE_URL}/holiday/approvals">Review it</a></p>`,
  );
}

export async function notifyLeaveDecision(
  staffId: string,
  decision: "approved" | "rejected",
  startDate: string,
  endDate: string,
  reason: string | null,
) {
  const admin = createAdminClient();
  const { data: staff } = await admin.from("profiles").select("full_name, email").eq("id", staffId).single();
  if (!staff) return;

  const subject =
    decision === "approved"
      ? `Your holiday request (${startDate} to ${endDate}) was approved`
      : `Your holiday request (${startDate} to ${endDate}) was rejected`;

  const body =
    decision === "approved"
      ? `<p>Your holiday request from ${startDate} to ${endDate} has been approved.</p>`
      : `<p>Your holiday request from ${startDate} to ${endDate} was rejected.</p>${
          reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""
        }`;

  await send([staff.email], subject, `${body}<p><a href="${SITE_URL}/holiday">View your holiday</a></p>`);
}

export async function notifyLieuDecision(
  staffId: string,
  decision: "approved" | "rejected",
  workDate: string,
  reason: string | null,
) {
  const admin = createAdminClient();
  const { data: staff } = await admin.from("profiles").select("full_name, email").eq("id", staffId).single();
  if (!staff) return;

  const subject =
    decision === "approved"
      ? `Your day-in-lieu request (${workDate}) was approved`
      : `Your day-in-lieu request (${workDate}) was rejected`;

  const body =
    decision === "approved"
      ? `<p>Your day-in-lieu request for working ${workDate} has been approved and added to your holiday allowance.</p>`
      : `<p>Your day-in-lieu request for working ${workDate} was rejected.</p>${
          reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""
        }`;

  await send([staff.email], subject, `${body}<p><a href="${SITE_URL}/holiday">View your holiday</a></p>`);
}
