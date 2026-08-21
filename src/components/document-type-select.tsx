"use client";

import { useState } from "react";

const ADD_SENTINEL = "__add_new_type__";

// Same list-with-inline-add as the stocktake unit dropdown: HR paperwork
// grows categories nobody predicted, and having to leave the page to add
// "Return to work interview" before you can file one is the sort of friction
// that ends with everything filed as "Other".
//
// A brand-new name rides along in its own field and the server adds it to
// the list, rather than needing a round-trip first.
export function DocumentTypeSelect({
  types,
  label = "Document type",
}: {
  types: string[];
  // null when the surrounding form already labels this step.
  label?: string | null;
}) {
  const [value, setValue] = useState(types[0] ?? "");
  const [addingNew, setAddingNew] = useState(false);

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
      {addingNew ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="new_document_type"
            autoFocus
            placeholder="New document type"
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setAddingNew(false)}
            className="text-sm text-muted-foreground hover:text-accent"
          >
            Cancel
          </button>
          {/* Keeps a value in the normal field so the server has a fallback
              if they leave the new-type box empty. */}
          <input type="hidden" name="document_type" value={value} />
        </div>
      ) : (
        <select
          name="document_type"
          value={value}
          onChange={(e) => {
            if (e.target.value === ADD_SENTINEL) {
              setAddingNew(true);
              return;
            }
            setValue(e.target.value);
          }}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={ADD_SENTINEL}>+ Add new type…</option>
        </select>
      )}
    </div>
  );
}
