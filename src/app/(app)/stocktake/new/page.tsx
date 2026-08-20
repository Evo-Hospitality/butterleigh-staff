import { requireUser } from "@/lib/auth";
import type { StockItem, StockLocation, StockType, StockUnit } from "@/lib/types";
import { StockTakeGrid } from "@/components/stock-take-grid";
import { addStockUnitAction, saveStockTakeAction } from "../actions";

export default async function NewStockTakePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { supabase } = await requireUser();
  const params = await searchParams;
  const type: StockType = params.type === "dry" ? "dry" : "wet";

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

  const knownGroups = [...new Set((items ?? []).map((i) => i.group_name))];
  const initialUnits = (unitRows ?? []).map((u) => u.name);

  const initialRows = (items ?? []).map((item) => ({
    key: item.id,
    stockItemId: item.id,
    groupName: item.group_name,
    name: item.name,
    unit: item.unit ?? "",
    unitPrice: item.unit_price != null ? String(item.unit_price) : "",
    quantities: {},
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary capitalize">New {type} stocktake</h1>
      <StockTakeGrid
        type={type}
        stockTakeId={null}
        initialStockDate={today}
        initialNotes=""
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
