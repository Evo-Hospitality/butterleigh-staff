import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

// Uploads to the public "maintenance-photos" bucket under a random path —
// nothing guessable/discoverable even though the bucket itself is public
// (see 0010_maintenance.sql for the tradeoff). Uses the caller's own
// authenticated client so the storage RLS insert policy (maintenance
// access required) actually applies.
export async function uploadMaintenancePhoto(supabase: SupabaseClient, file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Photo must be a JPEG, PNG, WEBP, GIF, or HEIC image.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Photo must be under 5MB.");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("maintenance-photos").upload(path, file, {
    contentType: file.type,
  });
  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("maintenance-photos").getPublicUrl(path);
  return data.publicUrl;
}
