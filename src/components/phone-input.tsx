"use client";

import { useState } from "react";
import { formatUkPhone } from "@/lib/phone";

// Formats the moment the number becomes a complete UK one, and leaves
// anything part-typed exactly as it is. That's the trick to not fighting
// whoever is typing: "0770090012" isn't a valid number, so it stays put, and
// the last digit is what turns it into +44 7700 900123.
//
// Also tidies on blur, for a paste that never reaches a complete state in a
// single keystroke. The server normalises again on save regardless.
export function PhoneInput({
  name,
  defaultValue,
  required = true,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(formatUkPhone(defaultValue));

  return (
    <input
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="off"
      required={required}
      placeholder="+44 7700 900123"
      value={value}
      onChange={(e) => setValue(formatUkPhone(e.target.value))}
      onBlur={(e) => setValue(formatUkPhone(e.target.value))}
      className="w-full rounded-md border border-border px-3 py-2 text-sm"
    />
  );
}
