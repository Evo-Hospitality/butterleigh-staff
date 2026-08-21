import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { StockItemChangeEntry, StockType } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

function formatValue(field: string, value: string | null) {
  if (value === null || value === "") return "—";
  return field === "unit_price" ? `£${Number(value).toFixed(2)}` : value;
}

type PriceTrend = {
  itemId: string;
  itemName: string;
  series: number[];
  first: number;
  latest: number;
  delta: number;
  pct: number | null;
  moves: number;
  direction: "rising" | "falling" | "mixed";
  lastChangedAt: string;
};

// Builds a price series per item from the change log. The first point is the
// price *before* the earliest recorded change, so a single change still
// yields a two-point line. A change where old_value is null is a price being
// set for the first time, not a movement — the series starts there rather
// than treating it as a rise from zero, which would make every newly-priced
// item look like runaway inflation.
function buildPriceTrends(changes: StockItemChangeEntry[]): PriceTrend[] {
  const byItem = new Map<string, StockItemChangeEntry[]>();
  for (const c of changes) {
    if (c.field !== "unit_price" || !c.stock_item_id || c.new_value === null) continue;
    const list = byItem.get(c.stock_item_id) ?? [];
    list.push(c);
    byItem.set(c.stock_item_id, list);
  }

  const trends: PriceTrend[] = [];
  for (const [itemId, list] of byItem) {
    const asc = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const series: number[] = [];
    if (asc[0].old_value !== null && asc[0].old_value !== "") {
      series.push(Number(asc[0].old_value));
    }
    for (const c of asc) series.push(Number(c.new_value));

    // One point means the price was set once and never moved — nothing to
    // trend, so it stays in the raw log below but not in this table.
    if (series.length < 2) continue;

    const first = series[0];
    const latest = series[series.length - 1];
    const deltas = series.slice(1).map((v, i) => v - series[i]);
    const direction = deltas.every((d) => d > 0)
      ? "rising"
      : deltas.every((d) => d < 0)
        ? "falling"
        : "mixed";

    trends.push({
      itemId,
      itemName: asc[asc.length - 1].item_name,
      series,
      first,
      latest,
      delta: latest - first,
      pct: first !== 0 ? ((latest - first) / first) * 100 : null,
      moves: deltas.length,
      direction,
      lastChangedAt: asc[asc.length - 1].created_at,
    });
  }

  // Biggest proportional rise first — that's what costs you money.
  return trends.sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity));
}

// Tiny inline SVG sparkline — enough to see the shape of a price at a glance.
function Sparkline({ series }: { series: number[] }) {
  const W = 72;
  const H = 22;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = series.length === 1 ? W / 2 : (i / (series.length - 1)) * (W - 4) + 2;
      const y = H - 3 - ((v - min) / span) * (H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = series[series.length - 1] >= series[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? "#b91c1c" : "#15803d"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const DIRECTION_STYLE: Record<PriceTrend["direction"], string> = {
  rising: "bg-red-100 text-red-800",
  falling: "bg-green-100 text-green-800",
  mixed: "bg-gray-100 text-gray-700",
};

const DIRECTION_LABEL: Record<PriceTrend["direction"], string> = {
  rising: "Rising",
  falling: "Falling",
  mixed: "Up & down",
};

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

  const trends = buildPriceTrends(changes ?? []);
  const risers = trends.filter((t) => t.delta > 0);
  const fallers = trends.filter((t) => t.delta < 0);
  // Average of each item's own % move — not a weighted basket, just "what's
  // happening to our prices on average".
  const avgPct = trends.length
    ? trends.reduce((sum, t) => sum + (t.pct ?? 0), 0) / trends.filter((t) => t.pct !== null).length
    : null;
  const biggest = trends[0];

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

      {trends.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Items with price movement</p>
              <p className="text-2xl font-bold text-primary">{trends.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {risers.length} up · {fallers.length} down
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Average change</p>
              <p
                className={`text-2xl font-bold ${
                  avgPct === null ? "text-primary" : avgPct > 0 ? "text-red-700" : avgPct < 0 ? "text-green-700" : "text-primary"
                }`}
              >
                {avgPct === null ? "—" : `${avgPct > 0 ? "+" : ""}${avgPct.toFixed(1)}%`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">across tracked items</p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Biggest riser</p>
              <p className="truncate text-lg font-bold text-primary" title={biggest?.itemName}>
                {biggest && biggest.delta > 0 ? biggest.itemName : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {biggest && biggest.delta > 0 && biggest.pct !== null
                  ? `+${biggest.pct.toFixed(1)}% since first counted`
                  : "no price rises recorded"}
              </p>
            </div>
          </div>

          <h2 className="mb-2 text-lg font-bold text-primary">Price trends</h2>
          <p className="mb-3 max-w-xl text-xs text-muted-foreground">
            Biggest proportional rise first. &ldquo;First&rdquo; is the price before the earliest
            recorded change, so an item only appears once its price has actually moved.
          </p>
          <div className="mb-8 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 font-medium">Trend</th>
                  <th className="px-2 py-2 font-medium">First</th>
                  <th className="px-2 py-2 font-medium">Latest</th>
                  <th className="px-2 py-2 font-medium">Change</th>
                  <th className="px-2 py-2 font-medium">Moves</th>
                  <th className="px-2 py-2 font-medium">Pattern</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t) => (
                  <tr key={t.itemId} className="border-t border-border">
                    <td className="px-4 py-2">{t.itemName}</td>
                    <td className="px-2 py-2">
                      <Sparkline series={t.series} />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">£{t.first.toFixed(2)}</td>
                    <td className="px-2 py-2 font-medium">£{t.latest.toFixed(2)}</td>
                    <td
                      className={`whitespace-nowrap px-2 py-2 ${
                        t.delta > 0 ? "text-red-700" : t.delta < 0 ? "text-green-700" : "text-muted-foreground"
                      }`}
                    >
                      {t.delta > 0 ? "+" : t.delta < 0 ? "-" : ""}£{Math.abs(t.delta).toFixed(2)}
                      {t.pct !== null && ` (${t.pct > 0 ? "+" : ""}${t.pct.toFixed(1)}%)`}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{t.moves}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIRECTION_STYLE[t.direction]}`}
                      >
                        {DIRECTION_LABEL[t.direction]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 text-lg font-bold text-primary">All changes</h2>
        </>
      )}

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
                  {formatDateTime(c.created_at)}
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
