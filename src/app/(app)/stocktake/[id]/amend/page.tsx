"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { StockTakeGrid } from "@/components/stock-take-grid";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import Loading from "../../../loading";
import { useSettledView, useStocktakeView } from "../../data";
import { addStockUnitAction, adminEditStockTakeAction } from "../../actions";

// Admin-only correction of a submitted stocktake — see admin_edit_stock_take
// (0047). Waits for fresh data like Resume does, so it never edits from a
// stale copy.
export default function AmendStockTakePage() {
  const { id } = useParams<{ id: string }>();
  const view = useStocktakeView("amend", { id });
  const settled = useSettledView(view, id);

  if (view.notFound) {
    return (
      <div>
        <Link href="/stocktake" className="text-sm text-muted-foreground hover:text-accent">
          &larr; Back to Stocktake
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">Stocktake not found.</p>
      </div>
    );
  }
  if (!view.data || !settled) return <Loading />;

  const { stockTake, initialRows, locations, knownGroups, initialUnits } = view.data;

  return (
    <div>
      <Link href={`/stocktake/${id}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to the stocktake
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-primary capitalize">Edit {stockTake.type} stocktake</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Counted as at {formatDateOnly(stockTake.stock_date)} and submitted by {stockTake.submitted_by_name}
        {stockTake.submitted_at && <> on {formatDateTime(stockTake.submitted_at)}</>} — that stays as it is. Your
        changes are noted on the stocktake. Prices changed here only affect this count, not the item list.
      </p>
      <StockTakeGrid
        key={stockTake.id}
        type={stockTake.type}
        stockTakeId={stockTake.id}
        initialStockDate={stockTake.stock_date}
        initialNotes={stockTake.notes ?? ""}
        initialRows={initialRows}
        locations={locations}
        knownGroups={knownGroups}
        initialUnits={initialUnits}
        saveAction={adminEditStockTakeAction}
        addUnitAction={addStockUnitAction}
        amend
      />
    </div>
  );
}
