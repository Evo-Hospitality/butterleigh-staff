"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendStaffInvite } from "@/lib/holiday/staff";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

// Self-service version of the admin's "Resend invite" button — same
// underlying reset-password email. Never reveals whether the address
// actually belongs to an account, so failures are swallowed the same as
// success (Supabase itself already does this for "no such user").
export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (email) {
    try {
      await sendStaffInvite(email);
    } catch {
      // deliberately silent — see comment above
    }
  }

  redirect("/login?forgot=1&sent=1");
}
