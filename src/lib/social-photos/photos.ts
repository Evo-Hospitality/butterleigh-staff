import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// What the photo picker serializes into the hidden "photos_json" field —
// each photo is already uploaded to storage by the time this arrives (see
// components/social-photo-picker.tsx), so this is just URLs.
type RawPhoto = {
  url: string;
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
    const { url } = raw as Record<string, unknown>;
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("A photo is missing its URL.");
    }
    return { url: url.trim() };
  });
}

// Unlike Events (photos optional on a suggestion), at least one photo is
// required here — the whole point of a post is the photos.
export async function insertPhotos(
  supabase: SupabaseClient,
  postId: string,
  submittedBy: string,
  submittedByName: string,
  photosJson: string,
) {
  const photos = parseRawPhotos(photosJson);
  if (photos.length === 0) {
    throw new Error("Add at least one photo.");
  }

  const rows = photos.map((p, i) => ({
    post_id: postId,
    submitted_by: submittedBy,
    submitted_by_name: submittedByName,
    url: p.url,
    sort_order: i,
  }));

  const { error } = await supabase.from("social_photos").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}
