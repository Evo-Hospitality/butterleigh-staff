import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { StockTake, StockTakeEntry, StockTakeQuantity } from "@/lib/types";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteSubmittedStockTakeAction } from "../actions";

export default async function StockTakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireUser();
  const { id } = await params;

  const { data: stockTake } = await supabase.from("stock_takes").select("*").eq("id", id).single<StockTake>();
  if (!stockTake) notFound();
  if (stockTake.status === "draft") {
    redirect(`/stocktake/${id}/edit`);
  }

  const { data: entries } = await supabase
    .from("stock_take_entries")
    .select("*")
    .eq("stock_take_id", id)
    .order("created_at")
    .returns<StockTakeEntry[]>();

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: quantities } = entryIds.length
    ? await supabase.from("stock_take_quantities").select("*").in("stock_take_entry_id", entryIds).returns<StockTakeQuantity[]>()
    : { data: [] as StockTakeQuantity[] };

  // Location columns come from the recorded quantities' own location_name
  // snapshot, not the current stock_locations list — a location could have
  // been renamed or removed since this stocktake ran; the historical
  // record shouldn't change because of that.
  const locationOrder: { key: string; name: string }[] = [];
  const seenLocations = new Set<string>();
  for (const q of quantities ?? []) {
    const key = q.location_id ?? q.location_name;
    if (!seenLocations.has(key)) {
      seenLocations.add(key);
      locationOrder.push({ key, name: q.location_name });
    }
  }

  const quantitiesByEntryId = new Map<string, Map<string, number>>();
  for (const q of quantities ?? []) {
    const key = q.location_id ?? q.location_name;
    const map = quantitiesByEntryId.get(q.stock_take_entry_id) ?? new Map<string, number>();
    map.set(key, Number(q.quantity));
    quantitiesByEntryId.set(q.stock_take_entry_id, map);
  }

  const groupOrder: string[] = [];
  for (const e of entries ?? []) {
    if (!groupOrder.includes(e.group_name)) groupOrder.push(e.group_name);
  }
  const groups = groupOrder.map((groupName) => ({
    groupName,
    entries: (entries ?? []).filter((e) => e.group_name === groupName),
  }));

  const grandTotal = (entries ?? []).reduce((sum, e) => sum + Number(e.value), 0);

  return (
    <div>
      <Link href="/stocktake" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Stocktake
      </Link>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-primary capitalize">{stockTake.type} stocktake</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Stock as at {stockTake.stock_date} · Submitted by {stockTake.submitted_by_name}
        {stockTake.submitted_at && <> on {new Date(stockTake.submitted_at).toLocaleString()}</>}
        {stockTake.notes && <> · {stockTake.notes}</>}
      </p>

      {groups.map(({ groupName, entries: groupEntries }) => (
        <div key={groupName} className="mb-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th colSpan={3 + locationOrder.length + 2} className="px-4 py-2 font-bold text-primary">
                  {groupName}
                </th>
              </tr>
              <tr>
                {/* Frozen, same as the counting grid — keeps the item
                    visible while scrolling location columns on a phone. */}
                <th className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  Name
                </th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 font-medium">Unit price</th>
                {locationOrder.map((loc) => (
                  <th key={loc.key} className="px-2 py-2 font-medium">
                    {loc.name}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">Total qty</th>
                <th className="px-2 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {groupEntries.map((entry) => {
                const qs = quantitiesByEntryId.get(entry.id);
                return (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                      <div className="w-28 break-words sm:w-56">{entry.item_name}</div>
                    </td>
                    <td className="px-2 py-1.5">{entry.unit ?? "—"}</td>
                    <td className="px-2 py-1.5">{entry.unit_price != null ? `£${entry.unit_price.toFixed(2)}` : "—"}</td>
                    {locationOrder.map((loc) => (
                      <td key={loc.key} className="px-2 py-1.5">
                        {qs?.get(loc.key)?.toFixed(2) ?? "0.00"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-muted-foreground">{entry.total_qty.toFixed(2)}</td>
                    <td className="px-2 py-1.5 font-medium">£{entry.value.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="mb-8 flex items-center justify-between rounded-md bg-muted px-4 py-3">
        <span className="font-medium">Grand total</span>
        <span className="text-lg font-bold text-primary">£{grandTotal.toFixed(2)}</span>
      </div>

      {profile.role === "admin" && (
        <ConfirmDeleteButton
          action={deleteSubmittedStockTakeAction.bind(null, id)}
          label="Delete this stocktake"
          confirmMessage={`Permanently delete the ${stockTake.type} stocktake from ${stockTake.stock_date}? This cannot be undone.`}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        />
      )}
    </div>
  );
}
