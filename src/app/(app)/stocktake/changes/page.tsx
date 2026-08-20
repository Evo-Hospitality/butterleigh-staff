import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { StockItemChangeEntry, StockType } from "@/lib/types";

function formatValue(field: string, value: string | null) {
  if (value === null || value === "") return "—";
  return field === "unit_price" ? `£${Number(value).toFixed(2)}` : value;
}

export default async function StockChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { supabase } = await requireUser();
  const params = await searchParams;
  const type: StockType = params.type === "dry" ? "dry" : "wet";

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

  return (
    <div>
      <Link href="/stocktake" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Stocktake
      </Link>

      <h1 className="mt-2 mb-2 text-2xl font-bold text-primary">Unit &amp; price history</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Every time a stocktake changes an item&apos;s unit or unit price, it&apos;s recorded here.
        Past stocktakes keep the values they were submitted with — a change only affects future ones.
      </p>

      <div className="mb-4 flex gap-3 text-sm">
        {(["wet", "dry"] as const).map((t) => (
          <a
            key={t}
            href={`/stocktake/changes?type=${t}`}
            className={`rounded-md border px-3 py-1.5 capitalize ${
              t === type ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
            }`}
          >
            {t}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">From</th>
              <th className="px-4 py-2 font-medium">To</th>
              <th className="px-4 py-2 font-medium">Changed by</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(changes ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">{c.item_name}</td>
                <td className="px-4 py-2">{c.field === "unit_price" ? "Unit price" : "Unit"}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatValue(c.field, c.old_value)}</td>
                <td className="px-4 py-2 font-medium">{formatValue(c.field, c.new_value)}</td>
                <td className="px-4 py-2">{c.changed_by_name}</td>
                <td className="px-4 py-2 text-right">
                  {c.stock_take_id && (
                    <Link href={`/stocktake/${c.stock_take_id}`} className="text-accent hover:underline">
                      Stocktake
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {(changes ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">
                  No changes recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
