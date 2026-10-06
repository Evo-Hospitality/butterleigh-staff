import { requireCheckinsAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMeetingReport } from "@/lib/checkins/meeting-report";

// The weekly management meeting pack as a Word download — same people and
// privacy rules as the Overview board (see src/lib/checkins/meeting-report.ts).
export async function GET() {
  const { supabase, profile } = await requireCheckinsAccess();
  const buffer = await buildMeetingReport(supabase, createAdminClient(), profile.full_name);

  const ukDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="management-meeting-${ukDate}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
