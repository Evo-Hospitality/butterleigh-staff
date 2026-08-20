import Link from "next/link";
import { requireMaintenanceAccess } from "@/lib/auth";
import type { MaintenanceRequest, MaintenanceUpdateEntry } from "@/lib/types";

function RequestTable({
  requests,
  empty,
  showClosedDate,
  latestUpdates,
}: {
  requests: MaintenanceRequest[];
  empty: string;
  showClosedDate?: boolean;
  latestUpdates?: Map<string, MaintenanceUpdateEntry>;
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
                {latestUpdates?.has(r.id) && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                    {latestUpdates.get(r.id)!.author_name}: {latestUpdates.get(r.id)!.note}
                  </p>
                )}
              </td>
              <td className="px-4 py-2">{r.submitted_by_name}</td>
              <td className="px-4 py-2">{r.assigned_to_name}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(showClosedDate ? (r.closed_at ?? r.created_at) : r.created_at).toLocaleDateString()}
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

export default async function MaintenancePage() {
  const { supabase } = await requireMaintenanceAccess();

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<MaintenanceRequest[]>();

  const open = (requests ?? []).filter((r) => r.status === "open");
  const closed = (requests ?? []).filter((r) => r.status === "closed");

  // Most recent log entry per open request, surfaced on the row so you can
  // see what's happened lately without opening each one. Open only —
  // activity on a closed request isn't what you're scanning for. Same
  // approach as the Actions list; maintenance_updates RLS already matches
  // maintenance_requests' visibility, so the caller's own client is fine.
  const openIds = open.map((r) => r.id);
  const latestUpdates = new Map<string, MaintenanceUpdateEntry>();
  if (openIds.length > 0) {
    const { data: updates } = await supabase
      .from("maintenance_updates")
      .select("*")
      .in("request_id", openIds)
      .order("created_at", { ascending: false })
      .returns<MaintenanceUpdateEntry[]>();
    for (const u of updates ?? []) {
      if (!latestUpdates.has(u.request_id)) {
        latestUpdates.set(u.request_id, u);
      }
    }
  }

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

      <h2 className="mb-3 text-lg font-bold text-primary">Closed requests</h2>
      <RequestTable requests={closed} empty="No closed requests yet." showClosedDate />
    </div>
  );
}
