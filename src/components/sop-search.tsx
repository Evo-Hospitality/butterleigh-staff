"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pin } from "lucide-react";

export type SopSearchEntry = {
  id: string;
  title: string;
  snippet: string;
  searchText: string;
  pinnedAt?: string | null;
};

export function SopSearch({
  entries,
  onTogglePin,
}: {
  entries: SopSearchEntry[];
  // Managers only: shows a pin button on each entry.
  onTogglePin?: (entry: SopSearchEntry) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.searchText.includes(q));
  }, [entries, query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search FAQs and SOPs…"
        className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex flex-col gap-2">
        {filtered.map((e) => (
          <div
            key={e.id}
            className={`relative rounded-lg border bg-background hover:border-accent ${
              e.pinnedAt ? "border-accent/60" : "border-border"
            }`}
          >
            <Link href={`/sops/${e.id}`} className={`block p-4 ${onTogglePin ? "pr-14" : ""}`}>
              <p className="flex items-center gap-1.5 font-medium text-primary">
                {e.pinnedAt && <Pin className="h-4 w-4 shrink-0 fill-accent text-accent" aria-label="Pinned" />}
                {e.title}
              </p>
              {e.snippet && <p className="mt-1 text-sm text-muted-foreground">{e.snippet}</p>}
            </Link>
            {onTogglePin && (
              <button
                type="button"
                onClick={() => onTogglePin(e)}
                title={e.pinnedAt ? "Unpin" : "Pin to the top"}
                aria-label={e.pinnedAt ? `Unpin ${e.title}` : `Pin ${e.title} to the top`}
                className={`absolute right-3 top-3 rounded-md p-1.5 hover:bg-muted ${
                  e.pinnedAt ? "text-accent" : "text-muted-foreground/60 hover:text-accent"
                }`}
              >
                <Pin className={`h-4 w-4 ${e.pinnedAt ? "fill-accent" : ""}`} />
              </button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {entries.length === 0 ? "No FAQs yet." : "Nothing matches that search."}
          </p>
        )}
      </div>
    </div>
  );
}
