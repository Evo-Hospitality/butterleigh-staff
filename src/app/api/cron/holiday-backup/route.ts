import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, NOTIFICATIONS_FROM_ADDRESS } from "@/lib/resend";
import { buildHolidayBackupCsvs } from "@/lib/holiday/backup";

// Triggered by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` on cron-triggered requests once that
// env var is set on the project — this must fail closed (refuse to run) if
// CRON_SECRET isn't configured, rather than skip the check, since this
// route is otherwise a public, unauthenticated full-data-dump endpoint.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipient = process.env.HOLIDAY_BACKUP_EMAIL;
  if (!recipient) {
    return NextResponse.json({ error: "HOLIDAY_BACKUP_EMAIL is not set" }, { status: 500 });
  }

  const admin = createAdminClient();
  const attachments = await buildHolidayBackupCsvs(admin);

  const today = new Date().toISOString().slice(0, 10);
  const resend = createResendClient();
  const { error } = await resend.emails.send({
    from: NOTIFICATIONS_FROM_ADDRESS,
    to: [recipient],
    subject: `Holiday data backup — ${today}`,
    html: `<p>Raw export of everything the Holiday app's numbers are built from, attached as CSV.</p>`,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "utf-8"),
    })),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
}
