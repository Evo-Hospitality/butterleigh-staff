import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFiles } from "@/lib/dropbox";

// What the photo picker serializes into the hidden "photos_json" field —
// each photo is already uploaded to storage by the time this arrives (see
// components/social-photo-picker.tsx), so this is just URLs. A video (0048)
// is already in Dropbox: url is its thumbnail, plus where the file is.
type RawPhoto = {
  url: string;
  video?: { dropboxPath: string; fileName: string | null; sizeBytes: number | null };
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
    const { url, kind, dropbox_path, file_name, size_bytes } = raw as Record<string, unknown>;
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("A photo is missing its URL.");
    }
    if (kind === "video") {
      if (typeof dropbox_path !== "string" || !dropbox_path.startsWith("/")) {
        throw new Error("A video is missing its Dropbox location.");
      }
      return {
        url: url.trim(),
        video: {
          dropboxPath: dropbox_path,
          fileName: typeof file_name === "string" ? file_name.slice(0, 200) : null,
          sizeBytes: typeof size_bytes === "number" ? Math.round(size_bytes) : null,
        },
      };
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
    // Video columns only when there is one, so photo-only posts don't depend
    // on 0048 having been run.
    ...(p.video
      ? { kind: "video", dropbox_path: p.video.dropboxPath, file_name: p.video.fileName, size_bytes: p.video.sizeBytes }
      : {}),
  }));

  const { error } = await supabase.from("social_photos").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

// Deleting is an admin-only, service-role operation (see deletePostAction)
// so it uses the admin client rather than the caller's own — there's no
// per-user storage delete policy on this bucket. Mirrors deleteEventPhotos.
// A deleted post's videos go from Dropbox too — best effort: a file already
// moved or removed there mustn't stop the post being deleted.
export async function deleteSocialVideos(dropboxPaths: string[]): Promise<void> {
  if (dropboxPaths.length === 0) return;
  await deleteFiles(dropboxPaths).catch(() => {});
}

export async function deleteSocialPhotos(photoUrls: string[]): Promise<void> {
  const paths = photoUrls
    .map((url) => url.split("/social-photos/")[1])
    .filter((path): path is string => !!path);
  if (paths.length === 0) return;

  const admin = createAdminClient();
  await admin.storage.from("social-photos").remove(paths);
}
