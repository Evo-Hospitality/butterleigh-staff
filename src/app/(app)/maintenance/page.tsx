import Link from "next/link";
import { requireMaintenanceAccess } from "@/lib/auth";
import type { MaintenanceRequest } from "@/lib/types";

function RequestTable({ requests, empty, showClosedDate }: { requests: MaintenanceRequest[]; empty: string; showClosedDate?: boolean }) {
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
        <RequestTable requests={open} empty="Nothing open right now." />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Closed requests</h2>
      <RequestTable requests={closed} empty="No closed requests yet." showClosedDate />
    </div>
  );
}
