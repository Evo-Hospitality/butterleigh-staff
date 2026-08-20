"use client";

// Same confirm-then-submit pattern as the per-app delete buttons in Events,
// Actions and Photos, but parameterised — Stocktake needs three of these
// (discard a draft, delete a submitted one from the list, delete one from
// its detail page) and three near-identical components isn't worth it.
export function ConfirmDeleteButton({
  action,
  label,
  confirmMessage,
  className = "text-red-600 hover:underline",
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
