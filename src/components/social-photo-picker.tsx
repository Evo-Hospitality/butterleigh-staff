"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { requestVideoUploadAction } from "@/app/(app)/social-photos/video-actions";

const MAX_PHOTO_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 150 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

export type PickedPhoto = {
  localId: string;
  status: "uploading" | "done" | "error";
  url: string | null; // the photo, or a video's thumbnail
  error?: string;
  isVideo?: boolean;
  progress?: number; // 0–100, videos only
  dropboxPath?: string;
  fileName?: string;
  sizeBytes?: number;
};

function newId() {
  return crypto.randomUUID();
}

// A still frame from the video, drawn in the browser, as the thumbnail kept
// in the app. If the phone/browser can't decode the video (e.g. an iPhone
// HEVC clip on some Windows browsers), a plain "Video" tile is drawn instead
// — the video itself still uploads.
async function videoThumbnail(file: File): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  const toBlob = () =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("thumbnail"))), "image/jpeg", 0.8),
    );

  const src = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = src;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      };
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("decode"));
      };
    });
    // Centre-crop to a square, matching how tiles are shown.
    const side = Math.min(video.videoWidth, video.videoHeight);
    ctx.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await toBlob();
  } catch {
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Video", canvas.width / 2, canvas.height / 2 + 16);
    return await toBlob();
  } finally {
    URL.revokeObjectURL(src);
  }
}

// Straight to Dropbox via the one-off link, with progress — XMLHttpRequest
// rather than fetch because fetch can't report upload progress.
function uploadToDropbox(link: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", link);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed — check the connection and try again."));
    xhr.send(file);
  });
}

// Embedded inside a parent <form>: photos upload straight to Supabase
// Storage on selection; videos go straight to Dropbox (the app keeps only a
// thumbnail — see 0048). The result rides in a hidden "photos_json" field.
// The type allowlists here are UX; the storage bucket's allowed_mime_types
// and the server's size check are what enforce it.
export function SocialPhotoPicker({ onPhotosChange }: { onPhotosChange?: (photos: PickedPhoto[]) => void }) {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updatePhoto(localId: string, patch: Partial<PickedPhoto>) {
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

  async function uploadImage(blob: Blob, ext: string, contentType: string): Promise<string> {
    const supabase = createClient();
    const path = `${newId()}.${ext}`;
    const { error } = await supabase.storage.from("social-photos").upload(path, blob, { contentType });
    if (error) throw new Error(error.message);
    return supabase.storage.from("social-photos").getPublicUrl(path).data.publicUrl;
  }

  async function handleVideo(localId: string, file: File) {
    if (file.size > MAX_VIDEO_SIZE) {
      updatePhoto(localId, { status: "error", error: "Videos must be under 150MB (about a minute). Trim it and try again." });
      return;
    }
    try {
      const [thumbUrl, link] = await Promise.all([
        videoThumbnail(file).then((blob) => uploadImage(blob, "jpg", "image/jpeg")),
        requestVideoUploadAction(file.name, file.size),
      ]);
      if (!link.ok) throw new Error(link.error);
      updatePhoto(localId, { url: thumbUrl, progress: 0 });
      await uploadToDropbox(link.link, file, (progress) => updatePhoto(localId, { progress }));
      updatePhoto(localId, {
        status: "done",
        dropboxPath: link.path,
        fileName: file.name,
        sizeBytes: file.size,
      });
    } catch (err) {
      updatePhoto(localId, { status: "error", error: err instanceof Error ? err.message : "Video upload failed." });
    }
  }

  async function handleFile(file: File) {
    const localId = newId();
    const isVideo = file.type.startsWith("video/");
    setPhotos((prev) => {
      const next = [...prev, { localId, status: "uploading" as const, url: null, isVideo }];
      onPhotosChange?.(next);
      return next;
    });

    if (isVideo) {
      await handleVideo(localId, file);
      return;
    }
    if (!PHOTO_TYPES.includes(file.type)) {
      updatePhoto(localId, { status: "error", error: "Must be a photo (JPEG, PNG, WEBP, GIF or HEIC) or a video." });
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      updatePhoto(localId, { status: "error", error: "Photo must be under 15MB." });
      return;
    }
    try {
      const url = await uploadImage(file, file.name.split(".").pop() || "jpg", file.type);
      updatePhoto(localId, { status: "done", url });
    } catch (err) {
      updatePhoto(localId, { status: "error", error: err instanceof Error ? err.message : "Upload failed." });
    }
  }

  const serializable = photos
    .filter((p) => p.status === "done")
    .map((p) =>
      p.isVideo
        ? { url: p.url, kind: "video", dropbox_path: p.dropboxPath, file_name: p.fileName, size_bytes: p.sizeBytes }
        : { url: p.url },
    );

  return (
    <div>
      <input type="hidden" name="photos_json" value={JSON.stringify(serializable)} />

      {photos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.localId} className="relative w-28 rounded-md border border-border bg-muted p-2">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="h-24 w-full rounded-md object-cover" />
              )}
              {p.status === "uploading" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.isVideo ? `Uploading video… ${p.progress ?? 0}%` : "Uploading…"}
                </p>
              )}
              {p.status === "done" && p.isVideo && <p className="mt-1 text-xs text-muted-foreground">Video ✓</p>}
              {p.status === "error" && <p className="text-xs text-red-700">{p.error}</p>}
              <button
                type="button"
                onClick={() => removePhoto(p.localId)}
                className="absolute -right-2 -top-2 rounded-full border border-border bg-white px-1.5 text-sm text-muted-foreground hover:text-red-700"
                aria-label="Remove"
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
        + Add photos or videos
      </button>
      <p className="mt-1 text-xs text-muted-foreground">Videos up to about a minute (150MB).</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          // Several can be picked at once from the camera roll; each one
          // uploads on its own, so one failure doesn't stop the rest.
          for (const file of Array.from(e.target.files ?? [])) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
