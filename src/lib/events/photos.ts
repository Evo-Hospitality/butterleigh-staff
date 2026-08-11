import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// What the photo picker serializes into the hidden "photos_json" field —
// each photo is already uploaded to storage by the time this arrives (see
// components/event-photo-picker.tsx), so this is just URLs/captions.
type RawPhoto = {
  url: string;
  caption?: string;
};

function parseRawPhotos(photosJson: string): RawPhoto[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(photosJson);
  } catch {
    throw new Error("Malformed photo list.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Malformed photo list.");
  }

  return parsed.map((raw): RawPhoto => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Malformed photo list.");
    }
    const { url, caption } = raw as Record<string, unknown>;
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("A photo is missing its URL.");
    }
    return {
      url: url.trim(),
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : undefined,
    };
  });
}

// A no-op on an empty array — photos are optional on a suggestion.
export async function insertPhotos(supabase: SupabaseClient, suggestionId: string, photosJson: string) {
  const photos = parseRawPhotos(photosJson);
  if (photos.length === 0) {
    return;
  }

  const rows = photos.map((p, i) => ({
    suggestion_id: suggestionId,
    url: p.url,
    caption: p.caption ?? null,
    sort_order: i,
  }));

  const { error } = await supabase.from("event_suggestion_photos").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

// Deleting is an admin-only, service-role operation (see deleteSuggestionAction)
// so it uses the admin client rather than the caller's own — there's no
// per-user storage delete policy on this bucket.
export async function deleteEventPhotos(photoUrls: string[]): Promise<void> {
  const paths = photoUrls
    .map((url) => url.split("/event-photos/")[1])
    .filter((path): path is string => !!path);
  if (paths.length === 0) return;

  const admin = createAdminClient();
  await admin.storage.from("event-photos").remove(paths);
}
