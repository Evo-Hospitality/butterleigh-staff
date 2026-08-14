"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

type Photo = {
  localId: string;
  status: "uploading" | "done" | "error";
  url: string | null;
  error?: string;
};

function newId() {
  return crypto.randomUUID();
}

// Same shape as components/event-photo-picker.tsx — embedded inside a
// parent <form>, uploads straight to Supabase Storage on selection, and
// exposes the result via a hidden "photos_json" field. No per-photo caption
// (Events has one; not needed here, the post itself has a caption) and no
// video accepted — accept="image/*" plus the client-side allowlist below
// are just UX; the storage bucket's own allowed_mime_types is what actually
// enforces it.
export function SocialPhotoPicker({ onPhotosChange }: { onPhotosChange?: (photos: Photo[]) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updatePhoto(localId: string, patch: Partial<Photo>) {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p));
      onPhotosChange?.(next);
      return next;
    });
  }

  function removePhoto(localId: string) {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.localId !== localId);
      onPhotosChange?.(next);
      return next;
    });
  }

  async function handleFile(file: File) {
    const localId = newId();
    setPhotos((prev) => {
      const next = [...prev, { localId, status: "uploading" as const, url: null }];
      onPhotosChange?.(next);
      return next;
    });

    if (!ALLOWED_TYPES.includes(file.type)) {
      updatePhoto(localId, { status: "error", error: "Must be a JPEG, PNG, WEBP, GIF, or HEIC image (no video)." });
      return;
    }
    if (file.size > MAX_SIZE) {
      updatePhoto(localId, { status: "error", error: "Photo must be under 15MB." });
      return;
    }

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${newId()}.${ext}`;
    const { error } = await supabase.storage.from("social-photos").upload(path, file, { contentType: file.type });
    if (error) {
      updatePhoto(localId, { status: "error", error: error.message });
      return;
    }
    const { data } = supabase.storage.from("social-photos").getPublicUrl(path);
    updatePhoto(localId, { status: "done", url: data.publicUrl });
  }

  const serializable = photos.filter((p) => p.status === "done").map((p) => ({ url: p.url }));

  return (
    <div>
      <input type="hidden" name="photos_json" value={JSON.stringify(serializable)} />

      {photos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.localId} className="relative w-28 rounded-md border border-border bg-muted p-2">
              {p.status === "uploading" && <p className="text-xs text-muted-foreground">Uploading…</p>}
              {p.status === "error" && <p className="text-xs text-red-700">{p.error}</p>}
              {p.status === "done" && p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="h-24 w-full rounded-md object-cover" />
              )}
              <button
                type="button"
                onClick={() => removePhoto(p.localId)}
                className="absolute -right-2 -top-2 rounded-full border border-border bg-white px-1.5 text-sm text-muted-foreground hover:text-red-700"
                aria-label="Remove photo"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
      >
        + Add photo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
