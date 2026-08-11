import "server-only";

import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "impersonation";
const MAX_AGE = 60 * 60 * 12; // safety bound — auto-expires even if never explicitly ended

type StashedSession = {
  adminAccessToken: string;
  adminRefreshToken: string;
  adminId: string;
  adminName: string;
  targetId: string;
  targetName: string;
  logId: string;
};

function readStash(raw: string | undefined): StashedSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StashedSession;
  } catch {
    return null;
  }
}

// Cheap, cookie-only check for the banner — no session/DB calls.
export async function getImpersonationState(): Promise<{ adminName: string; targetName: string } | null> {
  const cookieStore = await cookies();
  const stash = readStash(cookieStore.get(COOKIE_NAME)?.value);
  return stash ? { adminName: stash.adminName, targetName: stash.targetName } : null;
}

// Mints a real session for the target user server-side — never emailed,
// never redirects, invisible to them — then swaps the active session to it
// after stashing the admin's own tokens for restoration. Because it's a
// genuine session, every existing RLS policy applies automatically and
// correctly as that person; no authorization logic is duplicated here.
export async function startImpersonation(targetId: string) {
  const supabase = await createClient();
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();
  if (!adminUser) {
    throw new Error("Not authenticated");
  }

  const cookieStore = await cookies();
  if (cookieStore.get(COOKIE_NAME)) {
    throw new Error("You're already viewing as someone else — return to your account first.");
  }

  const { data: adminProfile } = await supabase.from("profiles").select("*").eq("id", adminUser.id).single();
  if (!adminProfile || adminProfile.role !== "admin") {
    throw new Error("Admin only");
  }
  if (targetId === adminUser.id) {
    throw new Error("You can't impersonate yourself.");
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("*").eq("id", targetId).single();
  if (!target) {
    throw new Error("Staff member not found");
  }
  if (!target.active) {
    throw new Error("Can't log in as an archived staff member.");
  }
  if (target.role === "admin") {
    throw new Error("Can't log in as another admin.");
  }

  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession();
  if (!adminSession) {
    throw new Error("Could not read your current session.");
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  if (linkError || !linkData) {
    throw new Error(linkError?.message ?? "Failed to start impersonation.");
  }

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !verifyData.session) {
    throw new Error(verifyError?.message ?? "Failed to start impersonation.");
  }

  const { data: logRow, error: logError } = await admin
    .from("impersonation_log")
    .insert({
      admin_id: adminUser.id,
      admin_name: adminProfile.full_name,
      target_id: targetId,
      target_name: target.full_name,
    })
    .select()
    .single();
  if (logError || !logRow) {
    throw new Error("Failed to record impersonation start.");
  }

  const stash: StashedSession = {
    adminAccessToken: adminSession.access_token,
    adminRefreshToken: adminSession.refresh_token,
    adminId: adminUser.id,
    adminName: adminProfile.full_name,
    targetId,
    targetName: target.full_name,
    logId: logRow.id,
  };

  cookieStore.set(COOKIE_NAME, JSON.stringify(stash), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  await supabase.auth.setSession({
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  });
}

export async function stopImpersonation() {
  const cookieStore = await cookies();
  const stash = readStash(cookieStore.get(COOKIE_NAME)?.value);
  if (!stash) {
    return;
  }

  const supabase = await createClient();
  await supabase.auth.setSession({
    access_token: stash.adminAccessToken,
    refresh_token: stash.adminRefreshToken,
  });

  const admin = createAdminClient();
  await admin.from("impersonation_log").update({ ended_at: new Date().toISOString() }).eq("id", stash.logId);

  cookieStore.delete(COOKIE_NAME);
}
