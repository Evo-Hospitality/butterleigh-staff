"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

type TextBlock = { localId: string; kind: "text"; body: string };
type PhotoBlock = {
  localId: string;
  kind: "photo";
  status: "uploading" | "done" | "error";
  url: string | null;
  caption: string;
  error?: string;
};
type LinkBlock = { localId: string; kind: "link"; url: string; caption: string };
type Block = TextBlock | PhotoBlock | LinkBlock;

function newId() {
  return crypto.randomUUID();
}

export type InitialBlock = {
  kind: "text" | "photo" | "link";
  body?: string | null;
  url?: string | null;
  caption?: string | null;
};

function fromInitialBlock(b: InitialBlock): Block {
  const localId = newId();
  if (b.kind === "text") return { localId, kind: "text", body: b.body ?? "" };
  if (b.kind === "photo") return { localId, kind: "photo", status: "done", url: b.url ?? null, caption: b.caption ?? "" };
  return { localId, kind: "link", url: b.url ?? "", caption: b.caption ?? "" };
}

export function SopBlockEditor({
  publishAction,
  publishLabel,
  draftAction,
  draftLabel = "Save as draft",
  titleLabel,
  titlePlaceholder,
  initialTitle,
  initialBlocks,
}: {
  publishAction: (formData: FormData) => Promise<void>;
  publishLabel: string;
  draftAction: (formData: FormData) => Promise<void>;
  draftLabel?: string;
  titleLabel: string;
  titlePlaceholder?: string;
  initialTitle?: string;
  initialBlocks?: InitialBlock[];
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [blocks, setBlocks] = useState<Block[]>(() => (initialBlocks ?? []).map(fromInitialBlock));
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addText() {
    setBlocks((prev) => [...prev, { localId: newId(), kind: "text", body: "" }]);
  }

  function addLink() {
    setBlocks((prev) => [...prev, { localId: newId(), kind: "link", url: "", caption: "" }]);
  }

  function removeBlock(localId: string) {
    setBlocks((prev) => prev.filter((b) => b.localId !== localId));
  }

  function updateBlock(localId: string, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.localId === localId ? ({ ...b, ...patch } as Block) : b)));
  }

  async function handlePhotoFile(file: File) {
    const localId = newId();
    setBlocks((prev) => [...prev, { localId, kind: "photo", status: "uploading", url: null, caption: "" }]);

    if (!ALLOWED_TYPES.includes(file.type)) {
      updateBlock(localId, { status: "error", error: "Must be a JPEG, PNG, WEBP, GIF, or HEIC image." });
      return;
    }
    if (file.size > MAX_SIZE) {
      updateBlock(localId, { status: "error", error: "Photo must be under 15MB." });
      return;
    }

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${newId()}.${ext}`;
    const { error } = await supabase.storage.from("sop-photos").upload(path, file, { contentType: file.type });
    if (error) {
      updateBlock(localId, { status: "error", error: error.message });
      return;
    }
    const { data } = supabase.storage.from("sop-photos").getPublicUrl(path);
    updateBlock(localId, { status: "done", url: data.publicUrl });
  }

  const hasPendingUploads = blocks.some((b) => b.kind === "photo" && b.status !== "done");
  // Publishing needs real content; a draft can be saved with just a title
  // to come back to later.
  const canPublish = title.trim().length > 0 && blocks.length > 0 && !hasPendingUploads;
  const canSaveDraft = title.trim().length > 0 && !hasPendingUploads;

  const serializable = blocks
    .filter((b) => b.kind !== "photo" || b.status === "done")
    .map((b) =>
      b.kind === "text"
        ? { kind: "text", body: b.body }
        : b.kind === "photo"
          ? { kind: "photo", url: b.url, caption: b.caption }
          : { kind: "link", url: b.url, caption: b.caption },
    );

  return (
    <form action={publishAction} className="flex max-w-2xl flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium">{titleLabel}</label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <input type="hidden" name="blocks_json" value={JSON.stringify(serializable)} />

      <div className="flex flex-col gap-3">
        {blocks.map((block) => (
          <div key={block.localId} className="flex gap-2 rounded-md border border-border bg-muted p-3">
            <div className="flex-1">
              {block.kind === "text" && (
                <textarea
                  value={block.body}
                  onChange={(e) => updateBlock(block.localId, { body: e.target.value })}
                  rows={3}
                  placeholder="Write a paragraph…"
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                />
              )}

              {block.kind === "photo" && (
                <div className="flex flex-col gap-2">
                  {block.status === "uploading" && (
                    <p className="text-sm text-muted-foreground">Uploading photo…</p>
                  )}
                  {block.status === "error" && <p className="text-sm text-red-700">{block.error}</p>}
                  {block.status === "done" && block.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.url} alt="" className="max-w-xs rounded-md border border-border" />
                  )}
                  <input
                    value={block.caption}
                    onChange={(e) => updateBlock(block.localId, { caption: e.target.value })}
                    placeholder="Context for this photo (optional)"
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                </div>
              )}

              {block.kind === "link" && (
                <div className="flex flex-col gap-2">
                  <input
                    value={block.url}
                    onChange={(e) => updateBlock(block.localId, { url: e.target.value })}
                    placeholder="https://…"
                    type="url"
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={block.caption}
                    onChange={(e) => updateBlock(block.localId, { caption: e.target.value })}
                    placeholder="Context for this link (optional)"
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeBlock(block.localId)}
              className="self-start text-sm text-muted-foreground hover:text-red-700"
              aria-label="Remove block"
            >
              &times;
            </button>
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">Add a text, photo, or link block to get started.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addText}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          + Add text
        </button>
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
            if (file) void handlePhotoFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={addLink}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          + Add link
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canPublish}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishLabel}
        </button>
        <button
          type="submit"
          formAction={draftAction}
          disabled={!canSaveDraft}
          className="self-start rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {draftLabel}
        </button>
      </div>
    </form>
  );
}
