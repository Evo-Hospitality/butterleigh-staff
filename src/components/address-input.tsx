"use client";

import { useState } from "react";
import { formatAddress } from "@/lib/address";

// Tidies the postcode when you leave the box, not as you type. A multi-line
// field is different from the one-line ones: rewriting its value mid-edit
// sends the cursor to the end, which is maddening if you're fixing something
// on the first line. The server normalises again on save regardless, so the
// stored address is right either way.
export function AddressInput({
  name = "home_address",
  defaultValue,
  required = true,
  rows = 3,
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
  rows?: number;
}) {
  const [value, setValue] = useState(formatAddress(defaultValue));

  return (
    <textarea
      name={name}
      rows={rows}
      required={required}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => setValue(formatAddress(e.target.value))}
      className="w-full rounded-md border border-border px-3 py-2 text-sm"
    />
  );
}
