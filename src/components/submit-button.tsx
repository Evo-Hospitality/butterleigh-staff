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
  className = "self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
