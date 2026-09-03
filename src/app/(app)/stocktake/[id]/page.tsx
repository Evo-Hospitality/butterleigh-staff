import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { StockTake } from "@/lib/types";
import { buildStockTakeSheet } from "@/lib/stocktake/sheet";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteSubmittedStockTakeAction } from "../actions";
import { formatDateOnly, formatDateTime } from "@/lib/format";

export default async function StockTakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, access } = await requireUser();
  const { id } = await params;

  const { data: stockTake } = await supabase.from("stock_takes").select("*").eq("id", id).single<StockTake>();
  if (!stockTake) notFound();
  if (stockTake.status === "draft") {
    redirect(`/stocktake/${id}/edit`);
  }

  const sheet = await buildStockTakeSheet(supabase, id);
  if (!sheet) notFound();
  const { locations: locationOrder, groups, grandTotal } = sheet;


  return (
    <div>
      <Link href="/stocktake" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Stocktake
      </Link>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-primary capitalize">{stockTake.type} stocktake</h1>
        <a
          href={`/stocktake/${id}/export`}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-primary hover:border-accent hover:text-accent"
        >
          Download as Excel
        </a>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Stock as at {formatDateOnly(stockTake.stock_date)} · Submitted by {stockTake.submitted_by_name}
        {stockTake.submitted_at && <> on {formatDateTime(stockTake.submitted_at)}</>}
        {stockTake.notes && <> · {stockTake.notes}</>}
      </p>

      {groups.map(({ groupName, rows: groupRows }) => (
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
              {groupRows.map(({ entry, quantities: qs }) => {
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

      {access("stocktake", "manage") && (
        <ConfirmDeleteButton
          action={deleteSubmittedStockTakeAction.bind(null, id)}
          label="Delete this stocktake"
          confirmMessage={`Permanently delete the ${stockTake.type} stocktake from ${formatDateOnly(stockTake.stock_date)}? This cannot be undone.`}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        />
      )}
    </div>
  );
}
