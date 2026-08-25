"use client";

import { useState } from "react";
import { formatName } from "@/lib/name-case";

// Tidies when you leave the box. Not as you type — capitalising a name
// keystroke by keystroke means fighting anyone whose surname needs a capital
// in the middle, and they'd never get to finish typing it. The server
// normalises again on save.
export function NameInput({
  name,
  defaultValue,
  required = true,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(formatName(defaultValue));

  return (
    <input
      name={name}
      type="text"
      autoComplete="off"
      required={required}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => setValue(formatName(e.target.value))}
      className="w-full rounded-md border border-border px-3 py-2 text-sm"
    />
  );
}
