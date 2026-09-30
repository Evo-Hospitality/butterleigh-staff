"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { StockTakeGrid } from "@/components/stock-take-grid";
import Loading from "../../../loading";
import { useSettledView, useStocktakeView } from "../../data";
import { addStockUnitAction, saveStockTakeAction } from "../../actions";

export default function EditStockTakePage() {
  const { id } = useParams<{ id: string }>();
  const view = useStocktakeView("edit", { id });
  const settled = useSettledView(view, id);

  if (view.notFound) {
    return (
      <div>
        <Link href="/stocktake" className="text-sm text-muted-foreground hover:text-accent">
          &larr; Back to Stocktake
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">Stocktake not found — it may have been discarded.</p>
      </div>
    );
  }
  if (!view.data || !settled) return <Loading />;

  const { stockTake, initialRows, locations, knownGroups, initialUnits } = view.data;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary capitalize">Resume {stockTake.type} stocktake</h1>
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
        saveAction={saveStockTakeAction}
        addUnitAction={addStockUnitAction}
      />
    </div>
  );
}
