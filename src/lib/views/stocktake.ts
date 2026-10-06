import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { buildStockTakeSheet } from "@/lib/stocktake/sheet";
import type {
  StockItem,
  StockItemChangeEntry,
  StockLocation,
  StockTake,
  StockTakeEntry,
  StockTakeQuantity,
  StockType,
  StockUnit,
} from "@/lib/types";
import type { ViewMap } from "./types";

function stockType(type: string | undefined): StockType {
  return type === "dry" ? "dry" : "wet";
}

// What the counting grid starts from — the full active item list for a type,
// with any quantities already counted in a draft laid over it.
function gridRows(items: StockItem[], quantitiesByItemId: Record<string, Record<string, string>> = {}) {
  return items.map((item) => ({
    key: item.id,
    stockItemId: item.id as string | null,
    groupName: item.group_name,
    name: item.name,
    unit: item.unit ?? "",
    unitPrice: item.unit_price != null ? String(item.unit_price) : "",
    quantities: quantitiesByItemId[item.id] ?? {},
  }));
}

export const views = {
  // /stocktake — drafts and submitted counts, with each one's total value.
  list: async () => {
    const { supabase } = await requireUser();

    const [{ data: stockTakes }, { data: entries }] = await Promise.all([
      supabase.from("stock_takes").select("*").order("created_at", { ascending: false }).returns<StockTake[]>(),
      supabase.from("stock_take_entries").select("stock_take_id, value").returns<Pick<StockTakeEntry, "stock_take_id" | "value">[]>(),
    ]);

    const valueByStockTake: Record<string, number> = {};
    for (const e of entries ?? []) {
      valueByStockTake[e.stock_take_id] = (valueByStockTake[e.stock_take_id] ?? 0) + Number(e.value);
    }

    return { stockTakes: stockTakes ?? [], valueByStockTake };
  },

  // /stocktake/new?type= — the item master list to count against.
  new: async ({ type: typeParam }) => {
    const { supabase } = await requireUser();
    const type = stockType(typeParam);

    const [{ data: items }, { data: locations }, { data: unitRows }] = await Promise.all([
      supabase
        .from("stock_items")
        .select("*")
        .eq("type", type)
        .eq("active", true)
        .order("sort_order")
        .returns<StockItem[]>(),
      supabase.from("stock_locations").select("*").eq("type", type).order("sort_order").returns<StockLocation[]>(),
      supabase.from("stock_units").select("*").eq("type", type).order("sort_order").returns<StockUnit[]>(),
    ]);

    return {
      type,
      initialRows: gridRows(items ?? []),
      locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name })),
      knownGroups: [...new Set((items ?? []).map((i) => i.group_name))],
      initialUnits: (unitRows ?? []).map((u) => u.name),
    };
  },

  // /stocktake/[id]/edit — resuming a draft.
  edit: async ({ id = "" }) => {
    const { supabase } = await requireUser();

    const { data: stockTake } = await supabase.from("stock_takes").select("*").eq("id", id).single<StockTake>();
    if (!stockTake) notFound();
    if (stockTake.status !== "draft") {
      redirect(`/stocktake/${id}`);
    }

    const [{ data: items }, { data: locations }, { data: entries }, { data: unitRows }] = await Promise.all([
      supabase
        .from("stock_items")
        .select("*")
        .eq("type", stockTake.type)
        .eq("active", true)
        .order("sort_order")
        .returns<StockItem[]>(),
      supabase
        .from("stock_locations")
        .select("*")
        .eq("type", stockTake.type)
        .order("sort_order")
        .returns<StockLocation[]>(),
      supabase.from("stock_take_entries").select("*").eq("stock_take_id", id).returns<StockTakeEntry[]>(),
      supabase.from("stock_units").select("*").eq("type", stockTake.type).order("sort_order").returns<StockUnit[]>(),
    ]);

    const entryIds = (entries ?? []).map((e) => e.id);
    const { data: quantities } = entryIds.length
      ? await supabase.from("stock_take_quantities").select("*").in("stock_take_entry_id", entryIds).returns<StockTakeQuantity[]>()
      : { data: [] as StockTakeQuantity[] };

    const quantitiesByEntryId = new Map<string, StockTakeQuantity[]>();
    for (const q of quantities ?? []) {
      const list = quantitiesByEntryId.get(q.stock_take_entry_id) ?? [];
      list.push(q);
      quantitiesByEntryId.set(q.stock_take_entry_id, list);
    }

    // What was actually entered in this draft's last save, keyed by item so
    // it can be overlaid onto the full current item list — unit/price
    // themselves don't need overlaying since a draft save already writes
    // those straight through to stock_items, so the master list already
    // reflects this draft's latest amendments.
    const quantitiesByItemId: Record<string, Record<string, string>> = {};
    for (const entry of entries ?? []) {
      if (!entry.stock_item_id) continue;
      const map: Record<string, string> = {};
      for (const q of quantitiesByEntryId.get(entry.id) ?? []) {
        if (q.location_id) map[q.location_id] = String(q.quantity);
      }
      quantitiesByItemId[entry.stock_item_id] = map;
    }

    return {
      stockTake: {
        id: stockTake.id,
        type: stockTake.type,
        stock_date: stockTake.stock_date,
        notes: stockTake.notes,
      },
      initialRows: gridRows(items ?? [], quantitiesByItemId),
      locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name })),
      knownGroups: [...new Set((items ?? []).map((i) => i.group_name))],
      initialUnits: (unitRows ?? []).map((u) => u.name),
    };
  },

  // /stocktake/[id]/amend — an admin correcting a submitted count. Unlike
  // resuming a draft, the rows come from the count's own lines (its units,
  // prices and quantities as submitted), since the master list may have
  // moved on since; current items it didn't include follow, blank.
  amend: async ({ id = "" }) => {
    const { supabase } = await requireAdmin();

    const { data: stockTake } = await supabase.from("stock_takes").select("*").eq("id", id).single<StockTake>();
    if (!stockTake) notFound();
    if (stockTake.status === "draft") {
      redirect(`/stocktake/${id}/edit`);
    }

    const [{ data: items }, { data: locations }, { data: entries }, { data: unitRows }] = await Promise.all([
      supabase
        .from("stock_items")
        .select("*")
        .eq("type", stockTake.type)
        .eq("active", true)
        .order("sort_order")
        .returns<StockItem[]>(),
      supabase
        .from("stock_locations")
        .select("*")
        .eq("type", stockTake.type)
        .order("sort_order")
        .returns<StockLocation[]>(),
      supabase.from("stock_take_entries").select("*").eq("stock_take_id", id).returns<StockTakeEntry[]>(),
      supabase.from("stock_units").select("*").eq("type", stockTake.type).order("sort_order").returns<StockUnit[]>(),
    ]);

    const entryIds = (entries ?? []).map((e) => e.id);
    const { data: quantities } = entryIds.length
      ? await supabase.from("stock_take_quantities").select("*").in("stock_take_entry_id", entryIds).returns<StockTakeQuantity[]>()
      : { data: [] as StockTakeQuantity[] };

    const qtyByEntry: Record<string, Record<string, string>> = {};
    for (const q of quantities ?? []) {
      if (!q.location_id) continue;
      (qtyByEntry[q.stock_take_entry_id] ??= {})[q.location_id] = String(q.quantity);
    }

    const rowFromEntry = (e: StockTakeEntry) => ({
      key: e.stock_item_id ?? e.id,
      stockItemId: e.stock_item_id,
      groupName: e.group_name,
      name: e.item_name,
      unit: e.unit ?? "",
      unitPrice: e.unit_price != null ? String(e.unit_price) : "",
      quantities: qtyByEntry[e.id] ?? {},
    });

    // Master-list order, using the count's own line where it has one; then
    // any lines whose item has since been retired from the list.
    const entryByItem = new Map((entries ?? []).filter((e) => e.stock_item_id).map((e) => [e.stock_item_id!, e]));
    const used = new Set<string>();
    const rows = (items ?? []).map((item) => {
      const e = entryByItem.get(item.id);
      if (e) {
        used.add(e.id);
        return rowFromEntry(e);
      }
      return gridRows([item])[0];
    });
    for (const e of entries ?? []) {
      if (!used.has(e.id)) rows.push(rowFromEntry(e));
    }

    return {
      stockTake: {
        id: stockTake.id,
        type: stockTake.type,
        stock_date: stockTake.stock_date,
        notes: stockTake.notes,
        submitted_by_name: stockTake.submitted_by_name,
        submitted_at: stockTake.submitted_at,
      },
      initialRows: rows,
      locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name })),
      knownGroups: [...new Set((items ?? []).map((i) => i.group_name))],
      initialUnits: (unitRows ?? []).map((u) => u.name),
    };
  },

  // /stocktake/[id] — a submitted count, laid out as on the Excel export.
  detail: async ({ id = "" }) => {
    const { supabase } = await requireUser();

    const { data: stockTake } = await supabase.from("stock_takes").select("*").eq("id", id).single<StockTake>();
    if (!stockTake) notFound();
    if (stockTake.status === "draft") {
      redirect(`/stocktake/${id}/edit`);
    }

    const sheet = await buildStockTakeSheet(supabase, id);
    if (!sheet) notFound();

    return {
      stockTake: {
        type: sheet.stockTake.type,
        stock_date: sheet.stockTake.stock_date,
        submitted_by_name: sheet.stockTake.submitted_by_name,
        submitted_at: sheet.stockTake.submitted_at,
        notes: sheet.stockTake.notes,
        edited_by_name: sheet.stockTake.edited_by_name ?? null,
        edited_at: sheet.stockTake.edited_at ?? null,
      },
      locations: sheet.locations,
      // The sheet keys each row's quantities by location in a Map — flattened
      // to a plain record so it survives the trip to the browser as JSON.
      groups: sheet.groups.map((g) => ({
        groupName: g.groupName,
        rows: g.rows.map(({ entry, quantities }) => ({
          entry,
          quantities: Object.fromEntries(quantities) as Record<string, number>,
        })),
      })),
      grandTotal: sheet.grandTotal,
    };
  },

  // /stocktake/changes?type= — the unit/price audit log for one type.
  changes: async ({ type: typeParam }) => {
    const { supabase } = await requireUser();
    const type = stockType(typeParam);

    // stock_item_changes has no type column of its own — it's derived from
    // the item the change belongs to, so filter by that item's type.
    const { data: itemIds } = await supabase.from("stock_items").select("id").eq("type", type);
    const ids = (itemIds ?? []).map((i) => i.id);

    const { data: changes } = ids.length
      ? await supabase
          .from("stock_item_changes")
          .select("*")
          .in("stock_item_id", ids)
          .order("created_at", { ascending: false })
          .limit(500)
          .returns<StockItemChangeEntry[]>()
      : { data: [] as StockItemChangeEntry[] };

    return { type, changes: changes ?? [] };
  },

  // /stocktake/report?type= — total value of each submitted count, oldest first.
  report: async ({ type: typeParam }) => {
    const { supabase } = await requireUser();
    const type = stockType(typeParam);

    const { data: stockTakes } = await supabase
      .from("stock_takes")
      .select("*")
      .eq("type", type)
      .eq("status", "submitted")
      .order("stock_date")
      .returns<StockTake[]>();

    const ids = (stockTakes ?? []).map((s) => s.id);
    const { data: entries } = ids.length
      ? await supabase
          .from("stock_take_entries")
          .select("stock_take_id, value")
          .in("stock_take_id", ids)
          .returns<Pick<StockTakeEntry, "stock_take_id" | "value">[]>()
      : { data: [] as Pick<StockTakeEntry, "stock_take_id" | "value">[] };

    const valueById: Record<string, number> = {};
    for (const e of entries ?? []) {
      valueById[e.stock_take_id] = (valueById[e.stock_take_id] ?? 0) + Number(e.value);
    }

    return {
      type,
      points: (stockTakes ?? []).map((s) => ({
        id: s.id,
        date: s.stock_date,
        submittedByName: s.submitted_by_name,
        value: valueById[s.id] ?? 0,
      })),
    };
  },
} satisfies ViewMap;
