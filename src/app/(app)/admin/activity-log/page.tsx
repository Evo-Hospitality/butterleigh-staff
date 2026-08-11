import { requireAdmin } from "@/lib/auth";
import type { ImpersonationLogEntry } from "@/lib/types";

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "still active";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default async function ActivityLogPage() {
  const { supabase } = await requireAdmin();

  const { data: entries } = await supabase
    .from("impersonation_log")
    .select("*")
    .order("started_at", { ascending: false })
    .returns<ImpersonationLogEntry[]>();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Activity log</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        A record of every time an admin has logged in as another staff member.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Admin</th>
              <th className="px-4 py-2 font-medium">Logged in as</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="px-4 py-2">{entry.admin_name}</td>
                <td className="px-4 py-2">{entry.target_name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(entry.started_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">{formatDuration(entry.started_at, entry.ended_at)}</td>
              </tr>
            ))}
            {(!entries || entries.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
