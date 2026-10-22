"use client";

import { useState } from "react";
import { SocialPhotoPicker, type PickedPhoto } from "./social-photo-picker";
import { SubmissionToken } from "./submission-token";
import { SubmitButton } from "./submit-button";

// Mirrors components/event-suggestion-form.tsx, with one difference: submit
// stays disabled until at least one photo has finished uploading, since a
// photo-less post doesn't fit this app's purpose (Events' photos are
// optional, so it only disables while uploads are in flight).
export function SocialPhotoPostForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const uploading = photos.some((p) => p.status === "uploading");
  const hasPhoto = photos.some((p) => p.status === "done");

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <SubmissionToken />
      <div>
        <label className="mb-1 block text-sm font-medium">Caption (optional)</label>
        <textarea
          name="caption"
          rows={3}
          placeholder="What's in these?"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Photos and videos</label>
        <SocialPhotoPicker onPhotosChange={setPhotos} />
      </div>

      <SubmitButton disabled={uploading || !hasPhoto} pendingLabel="Submitting…">
        Submit
      </SubmitButton>
    </form>
  );
}
