"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StockTakeStatus, StockType } from "@/lib/types";

type GridLocation = { id: string; name: string };

type GridRow = {
  key: string;
  stockItemId: string | null;
  groupName: string;
  name: string;
  unit: string;
  unitPrice: string;
  quantities: Record<string, string>;
};

type SaveResult = { ok: true; id: string } | { ok: false; error: string };
type AddUnitResult = { ok: true; name: string } | { ok: false; error: string };

const ADD_UNIT_SENTINEL = "__add_new_unit__";

export function StockTakeGrid({
  type,
  stockTakeId,
  initialStockDate,
  initialNotes,
  initialRows,
  locations,
  knownGroups,
  initialUnits,
  saveAction,
  addUnitAction,
}: {
  type: StockType;
  stockTakeId: string | null;
  initialStockDate: string;
  initialNotes: string;
  initialRows: GridRow[];
  locations: GridLocation[];
  knownGroups: string[];
  initialUnits: string[];
  addUnitAction: (type: StockType, name: string) => Promise<AddUnitResult>;
  saveAction: (payload: {
    stockTakeId: string | null;
    type: StockType;
    status: StockTakeStatus;
    stockDate: string;
    notes: string;
    entries: {
      stockItemId: string | null;
      groupName: string;
      name: string;
      unit: string;
      unitPrice: number | null;
      quantities: { locationId: string; quantity: number }[];
    }[];
  }) => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [stockDate, setStockDate] = useState(initialStockDate);
  const [notes, setNotes] = useState(initialNotes);
  const [rows, setRows] = useState<GridRow[]>(initialRows);
  const [newGroup, setNewGroup] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState<StockTakeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<string[]>(initialUnits);
  // Which row (if any) is currently showing the inline "new unit" input,
  // and what's been typed into it.
  const [addingUnitFor, setAddingUnitFor] = useState<string | null>(null);
  const [newUnitText, setNewUnitText] = useState("");

  const groups = useMemo(() => {
    const order: string[] = [];
    for (const r of rows) {
      if (!order.includes(r.groupName)) order.push(r.groupName);
    }
    return order.map((groupName) => ({ groupName, rows: rows.filter((r) => r.groupName === groupName) }));
  }, [rows]);

  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function updateQuantity(key: string, locationId: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, quantities: { ...r.quantities, [locationId]: value } } : r)),
    );
  }

  function addItem() {
    if (!newGroup.trim() || !newName.trim()) return;
    setRows((prev) => [
      ...prev,
      {
        key: `new-${crypto.randomUUID()}`,
        stockItemId: null,
        groupName: newGroup.trim(),
        name: newName.trim(),
        unit: "",
        unitPrice: "",
        quantities: {},
      },
    ]);
    setNewGroup("");
    setNewName("");
  }

  function handleUnitSelect(rowKey: string, value: string) {
    if (value === ADD_UNIT_SENTINEL) {
      setNewUnitText("");
      setAddingUnitFor(rowKey);
      return;
    }
    updateRow(rowKey, { unit: value });
  }

  async function confirmNewUnit(rowKey: string) {
    const name = newUnitText.trim();
    if (!name) {
      setAddingUnitFor(null);
      return;
    }

    const result = await addUnitAction(type, name);
    if (!result.ok) {
      setError(result.error);
      setAddingUnitFor(null);
      return;
    }

    setUnits((prev) => (prev.includes(result.name) ? prev : [...prev, result.name]));
    updateRow(rowKey, { unit: result.name });
    setAddingUnitFor(null);
    setNewUnitText("");
  }

  function totalQty(row: GridRow) {
    return locations.reduce((sum, loc) => sum + (Number(row.quantities[loc.id]) || 0), 0);
  }

  function rowValue(row: GridRow) {
    const price = Number(row.unitPrice) || 0;
    return totalQty(row) * price;
  }

  const grandTotal = rows.reduce((sum, r) => sum + rowValue(r), 0);

  async function handleSave(status: StockTakeStatus) {
    setError(null);
    if (!stockDate) {
      setError("Pick the stocktake date.");
      return;
    }
    if (rows.length === 0) {
      setError("Add at least one item.");
      return;
    }

    setSaving(status);
    const result = await saveAction({
      stockTakeId,
      type,
      status,
      stockDate,
      notes,
      entries: rows.map((r) => ({
        stockItemId: r.stockItemId,
        groupName: r.groupName,
        name: r.name,
        unit: r.unit,
        unitPrice: r.unitPrice.trim() === "" ? null : Number(r.unitPrice),
        quantities: locations.map((loc) => ({
          locationId: loc.id,
          quantity: Number(r.quantities[loc.id]) || 0,
        })),
      })),
    });
    setSaving(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(status === "submitted" ? `/stocktake/${result.id}` : `/stocktake/${result.id}/edit`);
  }

  return (
    <div>
      <datalist id="stock-groups">
        {knownGroups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            required
            value={stockDate}
            onChange={(e) => setStockDate(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Group</label>
          <input
            list="stock-groups"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder={type === "wet" ? "e.g. Draught Beer & Cider" : "e.g. Meat"}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Item name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={type === "wet" ? "e.g. Doom Bar" : "e.g. Beef mince"}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!newGroup.trim() || !newName.trim()}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          + Add item
        </button>
      </div>

      {error && <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {groups.map(({ groupName, rows: groupRows }) => (
        <div key={groupName} className="mb-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th colSpan={3 + locations.length} className="px-4 py-2 font-bold text-primary">
                  {groupName}
                </th>
              </tr>
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 font-medium">Unit price</th>
                {locations.map((loc) => (
                  <th key={loc.id} className="px-2 py-2 font-medium">
                    {loc.name}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">Total qty</th>
                <th className="px-2 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-1.5">{row.name}</td>
                  <td className="px-2 py-1.5">
                    {addingUnitFor === row.key ? (
                      <input
                        autoFocus
                        value={newUnitText}
                        onChange={(e) => setNewUnitText(e.target.value)}
                        onBlur={() => void confirmNewUnit(row.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void confirmNewUnit(row.key);
                          } else if (e.key === "Escape") {
                            setAddingUnitFor(null);
                          }
                        }}
                        placeholder="New unit"
                        className="w-24 rounded-md border border-accent px-2 py-1"
                      />
                    ) : (
                      <select
                        value={row.unit}
                        onChange={(e) => handleUnitSelect(row.key, e.target.value)}
                        className="w-24 rounded-md border border-border px-2 py-1"
                      >
                        <option value="">—</option>
                        {units.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        {/* A unit set before it was removed from the list
                            still needs to render as the current value. */}
                        {row.unit && !units.includes(row.unit) && <option value={row.unit}>{row.unit}</option>}
                        <option value={ADD_UNIT_SENTINEL}>+ Add new unit…</option>
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                      className="w-20 rounded-md border border-border px-2 py-1"
                    />
                  </td>
                  {locations.map((loc) => (
                    <td key={loc.id} className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={row.quantities[loc.id] ?? ""}
                        onChange={(e) => updateQuantity(row.key, loc.id, e.target.value)}
                        className="w-16 rounded-md border border-border px-2 py-1"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-muted-foreground">{totalQty(row).toFixed(2)}</td>
                  <td className="px-2 py-1.5 font-medium">£{rowValue(row).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="mb-6 text-sm text-muted-foreground">
          No items yet — add the first one above.
        </p>
      )}

      <div className="mb-6 flex items-center justify-between rounded-md bg-muted px-4 py-3">
        <span className="font-medium">Grand total</span>
        <span className="text-lg font-bold text-primary">£{grandTotal.toFixed(2)}</span>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSave("draft")}
          disabled={saving !== null}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent disabled:opacity-50"
        >
          {saving === "draft" ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={() => handleSave("submitted")}
          disabled={saving !== null}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving === "submitted" ? "Submitting…" : "Submit stocktake"}
        </button>
      </div>
    </div>
  );
}
