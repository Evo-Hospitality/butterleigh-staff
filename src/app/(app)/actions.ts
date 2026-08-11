"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getImpersonationState, stopImpersonation } from "@/lib/impersonation";

// While impersonating, "Sign out" should return the admin to their own
// account rather than fully signing out — a full sign-out would just be
// confusing (it'd sign out of the target's session, not the admin's).
export async function signOut() {
  if (await getImpersonationState()) {
    await stopImpersonation();
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function stopImpersonationAction() {
  await stopImpersonation();
  redirect("/");
}
