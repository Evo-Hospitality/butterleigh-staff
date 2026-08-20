import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { StockItem, StockLocation, StockTake, StockTakeEntry, StockTakeQuantity, StockUnit } from "@/lib/types";
import { StockTakeGrid } from "@/components/stock-take-grid";
import { addStockUnitAction, saveStockTakeAction } from "../../actions";

export default async function EditStockTakePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireUser();
  const { id } = await params;

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
  // it can be overlaid onto the full current item list below — unit/price
  // themselves don't need overlaying since a draft save already writes
  // those straight through to stock_items, so the master list already
  // reflects this draft's latest amendments.
  const quantitiesByItemId = new Map<string, Record<string, string>>();
  for (const entry of entries ?? []) {
    if (!entry.stock_item_id) continue;
    const qs = quantitiesByEntryId.get(entry.id) ?? [];
    const map: Record<string, string> = {};
    for (const q of qs) {
      if (q.location_id) map[q.location_id] = String(q.quantity);
    }
    quantitiesByItemId.set(entry.stock_item_id, map);
  }

  const knownGroups = [...new Set((items ?? []).map((i) => i.group_name))];
  const initialUnits = (unitRows ?? []).map((u) => u.name);

  const initialRows = (items ?? []).map((item) => ({
    key: item.id,
    stockItemId: item.id,
    groupName: item.group_name,
    name: item.name,
    unit: item.unit ?? "",
    unitPrice: item.unit_price != null ? String(item.unit_price) : "",
    quantities: quantitiesByItemId.get(item.id) ?? {},
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary capitalize">Resume {stockTake.type} stocktake</h1>
      <StockTakeGrid
        type={stockTake.type}
        stockTakeId={stockTake.id}
        initialStockDate={stockTake.stock_date}
        initialNotes={stockTake.notes ?? ""}
        initialRows={initialRows}
        locations={(locations ?? []).map((l) => ({ id: l.id, name: l.name }))}
        knownGroups={knownGroups}
        initialUnits={initialUnits}
        saveAction={saveStockTakeAction}
        addUnitAction={addStockUnitAction}
      />
    </div>
  );
}
