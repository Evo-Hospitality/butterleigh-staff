"use client";

import { useSearchParams } from "next/navigation";
import { StockTakeGrid } from "@/components/stock-take-grid";
import Loading from "../../loading";
import { useSettledView, useStocktakeView } from "../data";
import { addStockUnitAction, saveStockTakeAction } from "../actions";

export default function NewStockTakePage() {
  const typeParam = useSearchParams().get("type") === "dry" ? "dry" : "wet";
  const view = useStocktakeView("new", { type: typeParam });
  const settled = useSettledView(view, typeParam);
  if (!view.data || !settled) return <Loading />;

  const { type, initialRows, locations, knownGroups, initialUnits } = view.data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary capitalize">New {type} stocktake</h1>
      <StockTakeGrid
        key={type}
        type={type}
        stockTakeId={null}
        initialStockDate={today}
        initialNotes=""
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
