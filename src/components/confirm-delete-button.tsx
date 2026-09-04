"use client";

import { ConfirmButton } from "./confirm-button";

// Same confirm-then-submit pattern as the per-app delete buttons in Events,
// Actions and Photos, but parameterised — Stocktake needs three of these
// (discard a draft, delete a submitted one from the list, delete one from
// its detail page) and three near-identical components isn't worth it.
//
// Delete-flavoured styling over the generic ConfirmButton.
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
    <ConfirmButton
      action={action}
      label={label}
      confirmMessage={confirmMessage}
      className={className}
    />
  );
}
