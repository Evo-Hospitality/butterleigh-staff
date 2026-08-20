import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { StockTake, StockTakeEntry, StockType } from "@/lib/types";

type Point = {
  id: string;
  date: string;
  label: string;
  submittedByName: string;
  value: number;
};

function money(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The sign belongs outside the currency symbol — "£-300.00" reads wrong.
function signedMoney(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${money(Math.abs(n))}`;
}

// Compact axis labels — £12,345.67 down the side of a phone chart is noise.
function shortMoney(n: number) {
  if (n >= 1000) return `£${Math.round(n / 100) / 10}k`;
  return `£${Math.round(n)}`;
}

// Plain inline SVG rather than a charting library — one chart in the whole
// app doesn't justify a dependency, and this renders server-side with no
// hydration cost. Points are spaced evenly by position rather than by real
// date gaps: stocktakes are periodic, and true time-scaling would bunch
// them up unreadably after a couple of catch-up counts.
function ValueChart({ points }: { points: Point[] }) {
  const W = 620;
  const H = 240;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxValue = Math.max(...points.map((p) => p.value), 1);
  // Round the top of the scale up so the axis lands on a sane number.
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const yMax = Math.ceil(maxValue / (magnitude / 2)) * (magnitude / 2);

  const x = (i: number) => (points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  // Never more than ~6 date labels, whatever the history length.
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stock value over time">
      {gridLines.map((g) => {
        const gy = padT + plotH - g * plotH;
        return (
          <g key={g}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
            <text x={padL - 8} y={gy + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>
              {shortMoney(g * yMax)}
            </text>
          </g>
        );
      })}

      {points.length > 1 && (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
          fill="none"
          stroke="var(--color-accent, #ea580c)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {points.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(p.value)} r={4} fill="var(--color-accent, #ea580c)">
          <title>{`${p.label}: ${money(p.value)}`}</title>
        </circle>
      ))}

      {points.map((p, i) =>
        i % labelStep === 0 || i === points.length - 1 ? (
          <text
            key={`l-${p.id}`}
            x={x(i)}
            y={H - 12}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="currentColor"
            fillOpacity={0.55}
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export default async function StockValueReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { supabase } = await requireUser();
  const params = await searchParams;
  const type: StockType = params.type === "dry" ? "dry" : "wet";

  const { data: stockTakes } = await supabase
    .from("stock_takes")
    .select("*")
    .eq("type", type)
    .eq("status", "submitted")
    .order("stock_date")
    .returns<StockTake[]>();

  const ids = (stockTakes ?? []).map((s) => s.id);
  const { data: entries } = ids.length
    ? await supabase
        .from("stock_take_entries")
        .select("stock_take_id, value")
        .in("stock_take_id", ids)
        .returns<Pick<StockTakeEntry, "stock_take_id" | "value">[]>()
    : { data: [] as Pick<StockTakeEntry, "stock_take_id" | "value">[] };

  const valueById = new Map<string, number>();
  for (const e of entries ?? []) {
    valueById.set(e.stock_take_id, (valueById.get(e.stock_take_id) ?? 0) + Number(e.value));
  }

  const points: Point[] = (stockTakes ?? []).map((s) => ({
    id: s.id,
    date: s.stock_date,
    label: new Date(s.stock_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    submittedByName: s.submitted_by_name,
    value: valueById.get(s.id) ?? 0,
  }));

  // Newest first for the table; the chart reads left-to-right oldest-first.
  const rows = [...points].reverse();
  const latest = points.at(-1);
  const previous = points.at(-2);
  const movement = latest && previous ? latest.value - previous.value : null;

  return (
    <div>
      <Link href="/stocktake" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Stocktake
      </Link>

      <h1 className="mt-2 mb-2 text-2xl font-bold text-primary">Stock value over time</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Total value of each submitted {type} stocktake, valued at the unit prices in force when it
        was submitted. Drafts aren&apos;t included.
      </p>

      <div className="mb-6 flex gap-3 text-sm">
        {(["wet", "dry"] as const).map((t) => (
          <a
            key={t}
            href={`/stocktake/report?type=${t}`}
            className={`rounded-md border px-3 py-1.5 capitalize ${
              t === type ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
            }`}
          >
            {t}
          </a>
        ))}
      </div>

      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No submitted {type} stocktakes yet — the report fills in once you&apos;ve submitted one.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Latest ({latest!.label})</p>
              <p className="text-2xl font-bold text-primary">{money(latest!.value)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Change since previous</p>
              <p
                className={`text-2xl font-bold ${
                  movement === null ? "text-primary" : movement > 0 ? "text-green-700" : movement < 0 ? "text-red-700" : "text-primary"
                }`}
              >
                {movement === null ? "—" : signedMoney(movement)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Stocktakes counted</p>
              <p className="text-2xl font-bold text-primary">{points.length}</p>
            </div>
          </div>

          <div className="mb-8 overflow-hidden rounded-lg border border-border p-4 text-primary">
            <ValueChart points={points} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Stock date</th>
                  <th className="px-4 py-2 font-medium">Submitted by</th>
                  <th className="px-4 py-2 font-medium">Total value</th>
                  <th className="px-4 py-2 font-medium">Change</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  // rows is newest-first, so the next entry is the earlier count.
                  const prior = rows[i + 1];
                  const delta = prior ? p.value - prior.value : null;
                  const pct = prior && prior.value !== 0 ? (delta! / prior.value) * 100 : null;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2">{p.date}</td>
                      <td className="px-4 py-2">{p.submittedByName}</td>
                      <td className="px-4 py-2 font-medium">{money(p.value)}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 ${
                          delta === null ? "text-muted-foreground" : delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : ""
                        }`}
                      >
                        {delta === null
                          ? "—"
                          : `${signedMoney(delta)}${pct !== null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/stocktake/${p.id}`} className="text-accent hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
