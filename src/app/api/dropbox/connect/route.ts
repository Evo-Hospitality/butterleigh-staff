import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { authorizeUrl, dropboxConfigured } from "@/lib/dropbox";

// Admin → Social photos → "Connect Dropbox": off to Dropbox to approve the
// app, with a one-off state value checked on the way back.
export async function GET() {
  await requireAdmin();
  if (!dropboxConfigured()) {
    return NextResponse.redirect(
      new URL(`/admin/social-photos-settings?dropbox_error=${encodeURIComponent("The Dropbox app key and secret aren't set in Vercel yet.")}`, process.env.NEXT_PUBLIC_SITE_URL),
    );
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("dropbox_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
