"use client";

import { useState } from "react";
import type { views } from "@/lib/views/stocktake";
import { viewHooks } from "@/lib/client/view";

export const { useView: useStocktakeView } = viewHooks<typeof views>("stocktake");

// The counting grid copies its starting rows into its own state once, when it
// mounts, and a save writes every row's unit and price back to the master
// item list. So it mustn't mount from a saved copy that's gone stale — that
// could quietly put back a price someone else has since changed, or drop
// counts saved on another phone. Hold the grid back until the first
// background refresh has landed; after that it stays mounted, so later
// refreshes never wipe what's being typed. (If the refresh fails, e.g. no
// signal in the cellar, the saved copy is used rather than a blank screen.)
export function useSettledView<T extends { data: unknown; isFetching: boolean }>(view: T, key: string): boolean {
  // Remembered per key (the stocktake id or type) so moving to a different
  // count waits for its own fresh copy too.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const fresh = view.data !== undefined && !view.isFetching;
  if (fresh && settledKey !== key) setSettledKey(key);
  return settledKey === key || fresh;
}
