import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Deliberately unauthenticated — unlike /api/cron/*, this has no data to
// protect and needs to be reachable by Vercel Cron (or any external
// scheduler, if not on Vercel) with no secret to configure. Its only job is
// to touch the database daily so Supabase's free-tier 7-day idle pause
// never triggers.
export async function GET() {
  const admin = createAdminClient();
  const { error } = await admin.from("settings").select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, at: new Date().toISOString() }, { status: 500 });
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
