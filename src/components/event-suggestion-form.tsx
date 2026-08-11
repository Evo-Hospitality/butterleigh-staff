"use client";

import { useState } from "react";
import { EventPhotoPicker } from "./event-photo-picker";

export function EventSuggestionForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Idea</label>
        <input
          name="title"
          required
          placeholder="e.g. Pizza night"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Context (optional)</label>
        <textarea
          name="description"
          rows={4}
          placeholder="Why, what it'd look like, anything similar you've seen elsewhere…"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Example photos (optional)</label>
        <EventPhotoPicker onPendingChange={setUploading} />
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit idea
      </button>
    </form>
  );
}
