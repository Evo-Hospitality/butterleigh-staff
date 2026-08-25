"use client";

import { useState } from "react";
import { accountNumberDigits, formatSortCode } from "@/lib/bank-details";

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

// Digits only, capped at eight. Kept as text throughout — an account number
// beginning 0 is common, and the moment anything treats it as a number the
// leading zero is gone and the wages go nowhere.
export function AccountNumberInput({
  name = "bank_account_number",
  defaultValue,
  required = true,
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(accountNumberDigits(defaultValue));

  return (
    <input
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      placeholder="01234567"
      maxLength={8}
      value={value}
      onChange={(e) => setValue(accountNumberDigits(e.target.value))}
      className="w-full rounded-md border border-border px-3 py-2 text-sm"
    />
  );
}
