"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SopSearchEntry = {
  id: string;
  title: string;
  snippet: string;
  searchText: string;
};

export function SopSearch({ entries }: { entries: SopSearchEntry[] }) {
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
          <Link
            key={e.id}
            href={`/sops/${e.id}`}
            className="rounded-lg border border-border bg-background p-4 hover:border-accent"
          >
            <p className="font-medium text-primary">{e.title}</p>
            {e.snippet && <p className="mt-1 text-sm text-muted-foreground">{e.snippet}</p>}
          </Link>
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
