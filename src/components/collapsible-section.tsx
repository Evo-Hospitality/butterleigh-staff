"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

// Closed items are history — worth keeping to hand, not worth the scroll.
// Collapsed by default; the count stays visible so you know what's in there
// without opening it.
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex items-center gap-2 text-lg font-bold text-primary hover:text-accent"
      >
        <ChevronRight
          className={`h-5 w-5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </button>
      {open && children}
    </div>
  );
}
