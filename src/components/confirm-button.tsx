"use client";

// Confirm-then-submit, in the plainest form: a server action bound to a
// button, gated behind a browser confirm. ConfirmDeleteButton is this with
// delete-flavoured styling; anything else that needs a "are you sure"
// (moving a record between apps, say) uses this directly.
export function ConfirmButton({
  action,
  label,
  confirmMessage,
  className,
}: {
  action: () => Promise<void>;
  label: string;
  confirmMessage: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
