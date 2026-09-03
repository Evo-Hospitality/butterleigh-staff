import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockTake, StockTakeEntry, StockTakeQuantity } from "@/lib/types";

export type SheetLocation = { key: string; name: string };

export type SheetRow = {
  entry: StockTakeEntry;
  quantities: Map<string, number>;
};

export type SheetGroup = { groupName: string; rows: SheetRow[] };

export type StockTakeSheet = {
  stockTake: StockTake;
  locations: SheetLocation[];
  groups: SheetGroup[];
  grandTotal: number;
};

// Shapes a submitted stocktake into the grid that's shown on screen. Shared
// with the spreadsheet export so the download can't drift away from the page
// it was downloaded from.
export async function buildStockTakeSheet(
  supabase: SupabaseClient,
  id: string,
): Promise<StockTakeSheet | null> {
  const { data: stockTake } = await supabase
    .from("stock_takes")
    .select("*")
    .eq("id", id)
    .maybeSingle<StockTake>();
  if (!stockTake) return null;

  const { data: entries } = await supabase
    .from("stock_take_entries")
    .select("*")
    .eq("stock_take_id", id)
    .order("created_at")
    .returns<StockTakeEntry[]>();

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: quantities } = entryIds.length
    ? await supabase
        .from("stock_take_quantities")
        .select("*")
        .in("stock_take_entry_id", entryIds)
        .returns<StockTakeQuantity[]>()
    : { data: [] as StockTakeQuantity[] };

  // Location columns come from the recorded quantities' own location_name
  // snapshot, not the current stock_locations list — a location could have
  // been renamed or removed since this stocktake ran, and the historical
  // record shouldn't change because of that.
  const locations: SheetLocation[] = [];
  const seen = new Set<string>();
  for (const q of quantities ?? []) {
    const key = q.location_id ?? q.location_name;
    if (!seen.has(key)) {
      seen.add(key);
      locations.push({ key, name: q.location_name });
    }
  }

  const byEntry = new Map<string, Map<string, number>>();
  for (const q of quantities ?? []) {
    const key = q.location_id ?? q.location_name;
    const map = byEntry.get(q.stock_take_entry_id) ?? new Map<string, number>();
    map.set(key, Number(q.quantity));
    byEntry.set(q.stock_take_entry_id, map);
  }

  const groupOrder: string[] = [];
  for (const e of entries ?? []) {
    if (!groupOrder.includes(e.group_name)) groupOrder.push(e.group_name);
  }

  const groups: SheetGroup[] = groupOrder.map((groupName) => ({
    groupName,
    rows: (entries ?? [])
      .filter((e) => e.group_name === groupName)
      .map((entry) => ({ entry, quantities: byEntry.get(entry.id) ?? new Map<string, number>() })),
  }));

  return {
    stockTake,
    locations,
    groups,
    grandTotal: (entries ?? []).reduce((sum, e) => sum + Number(e.value), 0),
  };
}
