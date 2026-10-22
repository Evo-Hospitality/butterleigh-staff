"use server";

import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { MAX_VIDEO_BYTES, temporaryUploadLink } from "@/lib/dropbox";

export type VideoUploadLink = { ok: true; link: string; path: string } | { ok: false; error: string };

// Asks Dropbox for a one-off link the phone uploads a video straight to (see
// src/lib/dropbox.ts). Filed by month so the Dropbox folder stays tidy:
// /2026-10/2026-10-22 Nathan Murphy 1a2b3c4d.mp4
export async function requestVideoUploadAction(fileName: string, size: number): Promise<VideoUploadLink> {
  const { profile } = await requireUser();
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "That video looks empty." };
  if (size > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Videos must be under 150MB — about a minute of normal phone video. Trim it and try again." };
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const ext = (fileName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
  const who = profile.full_name.replace(/[^A-Za-z0-9 '-]/g, "").trim() || "Staff";
  const path = `/${day.slice(0, 7)}/${day} ${who} ${randomUUID().slice(0, 8)}.${ext}`;

  try {
    return { ok: true, link: await temporaryUploadLink(path), path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't start the video upload." };
  }
}
