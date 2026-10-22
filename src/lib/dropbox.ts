import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Dropbox for Photos for socials videos (0048). An app-folder Dropbox app:
// it can only see Apps/<app name>/ in the connected account. The app key and
// secret live in Vercel env vars; the refresh token from "Connect Dropbox"
// lives in dropbox_connection, readable only with the service-role key.

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export const DROPBOX_REDIRECT_PATH = "/api/dropbox/callback";
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // temporary upload links take one request up to 150MB

export function dropboxConfigured(): boolean {
  return !!APP_KEY && !!APP_SECRET;
}

export function redirectUri(): string {
  return `${SITE_URL}${DROPBOX_REDIRECT_PATH}`;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: APP_KEY ?? "",
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: redirectUri(),
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Dropbox sign-in failed: ${String(json.error_description ?? json.error ?? res.status)}`);
  }
  return json;
}

// The one-off code Dropbox hands back after "Allow" → a long-lived refresh token.
export async function exchangeCode(code: string): Promise<{ refreshToken: string; accessToken: string }> {
  const json = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  if (typeof json.refresh_token !== "string" || typeof json.access_token !== "string") {
    throw new Error("Dropbox didn't return a refresh token.");
  }
  return { refreshToken: json.refresh_token, accessToken: json.access_token };
}

// Short-lived access tokens (about 4 hours), reused while still fresh within
// a warm server instance.
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const admin = createAdminClient();
  const { data } = await admin.from("dropbox_connection").select("refresh_token").maybeSingle();
  if (!data?.refresh_token) {
    throw new Error("Dropbox isn't connected yet — an admin needs to connect it in Admin → Social photos.");
  }
  const json = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  const token = String(json.access_token);
  cached = { token, expiresAt: Date.now() + Number(json.expires_in ?? 14_400) * 1000 };
  return token;
}

async function rpc<T>(endpoint: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token ?? (await accessToken())}`, "Content-Type": "application/json" },
    body: body === null ? "null" : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dropbox ${endpoint} failed: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function accountName(token: string): Promise<string | null> {
  const acct = await rpc<{ name?: { display_name?: string }; email?: string }>("users/get_current_account", null, token);
  return acct?.name?.display_name ?? acct?.email ?? null;
}

// A one-off link the phone uploads the video to directly — the file never
// passes through this server (whose request size is capped far below a
// video). Valid for 4 hours, single use.
export async function temporaryUploadLink(path: string): Promise<string> {
  const json = await rpc<{ link: string }>("files/get_temporary_upload_link", {
    commit_info: { path, mode: "add", autorename: true, mute: true },
    duration: 14_400,
  });
  return json.link;
}

// A 4-hour link to watch or download a stored video.
export async function temporaryLink(path: string): Promise<string> {
  const json = await rpc<{ link: string }>("files/get_temporary_link", { path });
  return json.link;
}

export async function deleteFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await rpc("files/delete_batch", { entries: paths.map((path) => ({ path })) });
}
