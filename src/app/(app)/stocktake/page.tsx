import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { StockTake, StockTakeEntry } from "@/lib/types";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteStockTakeDraftAction, deleteSubmittedStockTakeAction } from "./actions";
import { formatDateOnly, formatDateTime } from "@/lib/format";

export default async function StockTakePage() {
  const { supabase, profile } = await requireUser();

  const [{ data: stockTakes }, { data: entries }] = await Promise.all([
    supabase.from("stock_takes").select("*").order("created_at", { ascending: false }).returns<StockTake[]>(),
    supabase.from("stock_take_entries").select("stock_take_id, value").returns<Pick<StockTakeEntry, "stock_take_id" | "value">[]>(),
  ]);

  const valueByStockTake = new Map<string, number>();
  for (const e of entries ?? []) {
    valueByStockTake.set(e.stock_take_id, (valueByStockTake.get(e.stock_take_id) ?? 0) + Number(e.value));
  }

  const drafts = (stockTakes ?? []).filter((s) => s.status === "draft");
  const submitted = (stockTakes ?? []).filter((s) => s.status === "submitted");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Stocktake</h1>
        <div className="flex items-center gap-2">
          <Link href="/stocktake/report" className="text-sm text-muted-foreground hover:text-accent">
            Value report
          </Link>
          <Link href="/stocktake/changes" className="mr-2 text-sm text-muted-foreground hover:text-accent">
            Unit &amp; price history
          </Link>
          <Link
            href="/stocktake/new?type=wet"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            New wet stocktake
          </Link>
          <Link
            href="/stocktake/new?type=dry"
            className="rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-white"
          >
            New dry stocktake
          </Link>
        </div>
      </div>

      {drafts.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-primary">Drafts</h2>
          <div className="mb-8 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Started by</th>
                  <th className="px-4 py-2 font-medium">Last saved</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {drafts.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 capitalize">{s.type}</td>
                    <td className="px-4 py-2">{formatDateOnly(s.stock_date)}</td>
                    <td className="px-4 py-2">{s.submitted_by_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDateTime(s.updated_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/stocktake/${s.id}/edit`} className="mr-4 text-accent hover:underline">
                        Resume
                      </Link>
                      <ConfirmDeleteButton
                        action={deleteStockTakeDraftAction.bind(null, s.id)}
                        label="Discard"
                        confirmMessage={`Discard this ${s.type} draft from ${formatDateOnly(s.stock_date)}? Everything counted so far will be lost.`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-bold text-primary">Submitted</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Stock date</th>
              <th className="px-4 py-2 font-medium">Submitted by</th>
              <th className="px-4 py-2 font-medium">Submitted</th>
              <th className="px-4 py-2 font-medium">Total value</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {submitted.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2 capitalize">
                  <Link href={`/stocktake/${s.id}`} className="font-medium hover:text-accent">
                    {s.type}
                  </Link>
                </td>
                <td className="px-4 py-2">{formatDateOnly(s.stock_date)}</td>
                <td className="px-4 py-2">{s.submitted_by_name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {s.submitted_at ? formatDateTime(s.submitted_at) : "—"}
                </td>
                <td className="px-4 py-2">£{(valueByStockTake.get(s.id) ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  {profile.role === "admin" && (
                    <ConfirmDeleteButton
                      action={deleteSubmittedStockTakeAction.bind(null, s.id)}
                      label="Delete"
                      confirmMessage={`Permanently delete the ${s.type} stocktake from ${formatDateOnly(s.stock_date)}? This cannot be undone.`}
                    />
                  )}
                </td>
              </tr>
            ))}
            {submitted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                  No stocktakes submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
