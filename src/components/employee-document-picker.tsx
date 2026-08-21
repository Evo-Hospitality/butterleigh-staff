"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
];

type Doc = {
  localId: string;
  fileName: string;
  status: "uploading" | "done" | "error";
  path: string | null;
  error?: string;
};

// Same shape as components/social-photo-picker.tsx: embedded in a parent
// <form>, uploads straight to Supabase Storage on selection, and hands the
// result to the server action through a hidden JSON field. Two differences,
// both because this bucket is private: it carries the storage PATH rather
// than a public URL, and there's no thumbnail — a filename, since half of
// these are PDFs.
//
// Uploading from the browser rather than through the server action is what
// makes several phone photos of a printed form work at all; a handful of
// them together would sail past the request size limit on a Server Action.
export function EmployeeDocumentPicker({
  staffId,
  pathPrefix,
  label = "+ Add file",
}: {
  staffId: string;
  // Where in the bucket to write. Defaults to the employee's own folder,
  // which is what they can read. An admin filing something passes
  // "admin/<staffId>" instead: the employee has no storage access there, so
  // an internal document can't be fished out directly even though it sits on
  // their record. See 0036.
  pathPrefix?: string;
  label?: string;
}) {
  const prefix = pathPrefix ?? staffId;
  const [docs, setDocs] = useState<Doc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateDoc(localId: string, patch: Partial<Doc>) {
    setDocs((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  }

  function removeDoc(localId: string) {
    setDocs((prev) => prev.filter((d) => d.localId !== localId));
  }

  async function handleFile(file: File) {
    const localId = crypto.randomUUID();
    setDocs((prev) => [...prev, { localId, fileName: file.name, status: "uploading", path: null }]);

    if (!ALLOWED_TYPES.includes(file.type)) {
      updateDoc(localId, { status: "error", error: "Must be a PDF or a photo (JPEG, PNG or HEIC)." });
      return;
    }
    if (file.size > MAX_SIZE) {
      updateDoc(localId, { status: "error", error: "Each file must be under 15MB." });
      return;
    }

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("employee-documents")
      .upload(path, file, { contentType: file.type });
    if (error) {
      updateDoc(localId, { status: "error", error: error.message });
      return;
    }
    updateDoc(localId, { status: "done", path });
  }

  const serializable = docs
    .filter((d) => d.status === "done" && d.path)
    .map((d) => ({ path: d.path, file_name: d.fileName }));

  const uploading = docs.some((d) => d.status === "uploading");

  return (
    <div>
      <input type="hidden" name="documents_json" value={JSON.stringify(serializable)} />
      {/* Blocks submit until every file has finished landing, so a slow
          upload can't be beaten by an impatient click. */}
      <input type="hidden" name="documents_uploading" value={uploading ? "1" : ""} />

      {docs.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {docs.map((d) => (
            <li
              key={d.localId}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {d.fileName}
                {d.status === "uploading" && (
                  <span className="ml-2 text-xs text-muted-foreground">uploading…</span>
                )}
                {d.status === "error" && <span className="ml-2 text-xs text-red-700">{d.error}</span>}
                {d.status === "done" && <span className="ml-2 text-xs text-green-700">ready</span>}
              </span>
              <button
                type="button"
                onClick={() => removeDoc(d.localId)}
                className="rounded-full border border-border bg-white px-2 text-sm text-muted-foreground hover:text-red-700"
                aria-label={`Remove ${d.fileName}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
      >
        {label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          for (const file of Array.from(e.target.files ?? [])) {
            void handleFile(file);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
