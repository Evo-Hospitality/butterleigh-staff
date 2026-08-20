import { requireAdmin } from "@/lib/auth";
import type { StockLocation, StockType } from "@/lib/types";
import { addStockLocation, deleteStockLocation } from "./actions";

export default async function StockLocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const type: StockType = params.type === "dry" ? "dry" : "wet";

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("*")
    .eq("type", type)
    .order("sort_order")
    .returns<StockLocation[]>();

  const addAction = addStockLocation.bind(null, type);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Stock locations</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Each location shows up as its own quantity column on a stocktake. Wet and dry have
        separate location lists.
      </p>

      <div className="mb-4 flex gap-3 text-sm">
        {(["wet", "dry"] as const).map((t) => (
          <a
            key={t}
            href={`/admin/stock-locations?type=${t}`}
            className={`rounded-md border px-3 py-1.5 capitalize ${
              t === type ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
            }`}
          >
            {t}
          </a>
        ))}
      </div>

      <form action={addAction} className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Location name</label>
          <input
            name="name"
            required
            placeholder="e.g. Main Bar, Cellar"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add
        </button>
      </form>

      <div className="max-w-md overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {locations?.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteStockLocation.bind(null, l.id, type)}>
                    <button type="submit" className="text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!locations || locations.length === 0) && (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">
                  No {type} locations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
