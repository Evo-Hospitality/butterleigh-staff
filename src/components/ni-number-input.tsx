"use client";

import { useState } from "react";
import { formatNiNumber } from "@/lib/ni-number";

// Uppercases and strips spaces as you type, so it always reads QQ123456C
// however it was copied off a payslip. The server normalises again on save.
export function NiNumberInput({
  name = "ni_number",
  defaultValue,
  required = true,
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(formatNiNumber(defaultValue));

  return (
    <input
      name={name}
      type="text"
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      required={required}
      placeholder="QQ123456C"
      maxLength={9}
      value={value}
      onChange={(e) => setValue(formatNiNumber(e.target.value))}
      className="w-full rounded-md border border-border px-3 py-2 text-sm uppercase"
    />
  );
}
