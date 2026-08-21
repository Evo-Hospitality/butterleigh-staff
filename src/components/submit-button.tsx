"use client";

import { useFormStatus } from "react-dom";

// Must be rendered *inside* the <form> it belongs to — that's how
// useFormStatus finds it. Disables itself while the submission is in
// flight, which is what stops an impatient second press during a slow
// upload. The server-side submission token (0026_submission_tokens.sql) is
// what actually guarantees no duplicate; this just makes the wait visible.
export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  formAction,
  className = "self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  // For forms with their own reason to block submission (a photo still
  // uploading, no photo chosen yet) — ORed with the pending state rather
  // than replacing it.
  disabled?: boolean;
  // For a second submit button that posts to a different action (SOPs'
  // "Save draft" alongside "Publish").
  formAction?: (formData: FormData) => Promise<void>;
  className?: string;
}) {
  // Pending is per-form, not per-button, so on a two-button form both
  // disable while either is submitting — which is what you want: you
  // shouldn't be able to hit "Save draft" mid-publish either.
  const { pending } = useFormStatus();
  return (
    <button type="submit" formAction={formAction} disabled={pending || disabled} className={className}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
