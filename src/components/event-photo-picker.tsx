"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

type Photo = {
  localId: string;
  status: "uploading" | "done" | "error";
  url: string | null;
  caption: string;
  error?: string;
};

function newId() {
  return crypto.randomUUID();
}

// Embedded inside a parent <form> (not its own form, unlike SopBlockEditor)
// — just manages the photo array and exposes it via a hidden "photos_json"
// field for the parent's Server Action to read. Reports upload-in-progress
// state so the parent can disable its submit button meanwhile.
export function EventPhotoPicker({ onPendingChange }: { onPendingChange?: (pending: boolean) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updatePhoto(localId: string, patch: Partial<Photo>) {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p));
      onPendingChange?.(next.some((p) => p.status === "uploading"));
      return next;
    });
  }

  function removePhoto(localId: string) {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.localId !== localId);
      onPendingChange?.(next.some((p) => p.status === "uploading"));
      return next;
    });
  }

  async function handleFile(file: File) {
    const localId = newId();
    setPhotos((prev) => [...prev, { localId, status: "uploading", url: null, caption: "" }]);
    onPendingChange?.(true);

    if (!ALLOWED_TYPES.includes(file.type)) {
      updatePhoto(localId, { status: "error", error: "Must be a JPEG, PNG, WEBP, GIF, or HEIC image." });
      return;
    }
    if (file.size > MAX_SIZE) {
      updatePhoto(localId, { status: "error", error: "Photo must be under 5MB." });
      return;
    }

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${newId()}.${ext}`;
    const { error } = await supabase.storage.from("event-photos").upload(path, file, { contentType: file.type });
    if (error) {
      updatePhoto(localId, { status: "error", error: error.message });
      return;
    }
    const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
    updatePhoto(localId, { status: "done", url: data.publicUrl });
  }

  const serializable = photos
    .filter((p) => p.status === "done")
    .map((p) => ({ url: p.url, caption: p.caption }));

  return (
    <div>
      <input type="hidden" name="photos_json" value={JSON.stringify(serializable)} />

      {photos.length > 0 && (
        <div className="mb-3 flex flex-col gap-3">
          {photos.map((p) => (
            <div key={p.localId} className="flex gap-2 rounded-md border border-border bg-muted p-3">
              <div className="flex-1">
                {p.status === "uploading" && <p className="text-sm text-muted-foreground">Uploading photo…</p>}
                {p.status === "error" && <p className="text-sm text-red-700">{p.error}</p>}
                {p.status === "done" && p.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="max-w-xs rounded-md border border-border" />
                )}
                <input
                  value={p.caption}
                  onChange={(e) => updatePhoto(p.localId, { caption: e.target.value })}
                  placeholder="What's this a photo of? (optional)"
                  className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(p.localId)}
                className="self-start text-sm text-muted-foreground hover:text-red-700"
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
