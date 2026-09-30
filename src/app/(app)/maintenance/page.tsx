"use client";

import Link from "next/link";
import Loading from "../loading";
import { useMaintenanceView } from "./data";
import { CollapsibleSection } from "@/components/collapsible-section";
import type { MaintenanceRequest, MaintenanceUpdateEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";

function RequestTable({
  requests,
  empty,
  showClosedDate,
  latestUpdates,
}: {
  requests: MaintenanceRequest[];
  empty: string;
  showClosedDate?: boolean;
  latestUpdates?: Record<string, MaintenanceUpdateEntry>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Reported by</th>
            <th className="px-4 py-2 font-medium">Assigned to</th>
            <th className="px-4 py-2 font-medium">{showClosedDate ? "Closed" : "Reported"}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link href={`/maintenance/${r.id}`} className="font-medium hover:text-accent">
                  {r.title}
                </Link>
                {latestUpdates?.[r.id] && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                    {latestUpdates[r.id].author_name}: {latestUpdates[r.id].note}
                  </p>
                )}
              </td>
              <td className="px-4 py-2">{r.submitted_by_name}</td>
              <td className="px-4 py-2">{r.assigned_to_name}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {formatDate(showClosedDate ? (r.closed_at ?? r.created_at) : r.created_at)}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function MaintenancePage() {
  const view = useMaintenanceView("list");
  if (!view.data) return <Loading />;

  const { open, closed, latestUpdates } = view.data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Maintenance</h1>
        <Link
          href="/maintenance/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Report an issue
        </Link>
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Open requests</h2>
      <div className="mb-8">
        <RequestTable requests={open} empty="Nothing open right now." latestUpdates={latestUpdates} />
      </div>

      <CollapsibleSection title="Closed requests" count={closed.length}>
        <RequestTable requests={closed} empty="No closed requests yet." showClosedDate />
      </CollapsibleSection>
    </div>
  );
}
