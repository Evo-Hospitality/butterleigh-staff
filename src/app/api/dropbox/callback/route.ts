import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { accountName, exchangeCode } from "@/lib/dropbox";
import { createAdminClient } from "@/lib/supabase/admin";

// Dropbox sends the admin back here after "Allow". The code is swapped for a
// long-lived refresh token, kept in dropbox_connection (service-role only).
export async function GET(request: NextRequest) {
  const { profile } = await requireAdmin();
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/admin/social-photos-settings?${query}`, process.env.NEXT_PUBLIC_SITE_URL));

  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  if (params.get("error")) {
    return back(`dropbox_error=${encodeURIComponent(params.get("error_description") || "Dropbox access wasn't allowed.")}`);
  }
  if (!code || !state || state !== request.cookies.get("dropbox_oauth_state")?.value) {
    return back(`dropbox_error=${encodeURIComponent("That Dropbox link had expired — try Connect Dropbox again.")}`);
  }

  try {
    const { refreshToken, accessToken } = await exchangeCode(code);
    const name = await accountName(accessToken).catch(() => null);
    const { error } = await createAdminClient()
      .from("dropbox_connection")
      .upsert({
        id: true,
        refresh_token: refreshToken,
        account_name: name,
        connected_by: profile.id,
        connected_by_name: profile.full_name,
        connected_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
  } catch (err) {
    return back(`dropbox_error=${encodeURIComponent(err instanceof Error ? err.message : "Couldn't connect Dropbox.")}`);
  }

  const res = back("dropbox=connected");
  res.cookies.delete("dropbox_oauth_state");
  return res;
}
