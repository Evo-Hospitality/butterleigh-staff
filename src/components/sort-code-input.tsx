"use client";

import { useState } from "react";
import { formatSortCode } from "@/lib/sort-code";

// Puts the hyphens in as you type, so the box always reads 12-34-56 whether
// you typed the dashes, spaces, or nothing at all. The server normalises the
// value again on save, so a paste that dodges this still lands correctly.
export function SortCodeInput({
  name = "bank_sort_code",
  defaultValue,
  required = true,
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(formatSortCode(defaultValue));

  return (
    <input
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      placeholder="12-34-56"
      // 8 characters: six digits and two hyphens.
      maxLength={8}
      value={value}
      onChange={(e) => setValue(formatSortCode(e.target.value))}
      className="w-full rounded-md border border-border px-3 py-2 text-sm"
    />
  );
}
