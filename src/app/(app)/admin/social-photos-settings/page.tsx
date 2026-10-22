"use client";

import { useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { saveReviewerAction } from "./actions";
import Loading from "../../loading";
import { useSettingsView } from "../settings-data";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function SocialPhotosSettingsPage() {
  const params = useSearchParams();
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;

  const view = useSettingsView("socialPhotosSettings", { year: String(year), month: String(month) });
  if (!view.data) return <Loading />;

  const { reviewerId, staff, rows, dropbox } = view.data;
  const dropboxError = params.get("dropbox_error");
  const justConnected = params.get("dropbox") === "connected";

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Social photos</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        New photo submissions notify whoever&apos;s set below, and only they (or an admin) can mark
        individual photos as used. Marking a photo used pays £1 to hourly staff, tracked below by
        the month the checkmark was set.
      </p>

      {/* Keyed by the saved value so the picker shows it after a save. */}
      <form key={reviewerId} action={saveReviewerAction} className="mb-8 flex max-w-md items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Reviewer</label>
          <select
            name="social_photos_reviewer_id"
            defaultValue={reviewerId}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="">Nobody set — submissions won&apos;t be emailed</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </form>

      <div className="mb-8 max-w-xl rounded-lg border border-border p-4">
        <h2 className="mb-1 text-lg font-bold text-primary">Videos (Dropbox)</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Videos are too big to keep in the app, so they upload straight to Dropbox (Apps → your
          Butterleigh videos folder) and only a thumbnail is kept here. A used video earns £1, the
          same as a photo.
        </p>
        {justConnected && (
          <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Dropbox connected.</p>
        )}
        {dropboxError && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{dropboxError}</p>
        )}
        {!dropbox?.configured ? (
          <p className="text-sm text-yellow-800">
            The Dropbox app key and secret aren&apos;t set in Vercel yet, so videos can&apos;t be uploaded.
          </p>
        ) : dropbox.connected ? (
          <p className="text-sm">
            Connected{dropbox.accountName && <> to <strong>{dropbox.accountName}</strong></>}
            {dropbox.connectedByName && <> by {dropbox.connectedByName}</>}
            {dropbox.connectedAt && <> on {formatDateTime(dropbox.connectedAt)}</>}.{" "}
            <a href="/api/dropbox/connect" target="_top" className="text-accent hover:underline">
              Reconnect
            </a>
          </p>
        ) : (
          <a
            href="/api/dropbox/connect"
            target="_top"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Connect Dropbox
          </a>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">
          Payroll report — {MONTH_NAMES[month - 1]} {year}
        </h2>
        <a
          href={`/admin/social-photos-settings/csv?year=${year}&month=${month}`}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 flex gap-3 text-sm">
        {[-1, 0, 1].map((offset) => {
          const d = new Date(year, month - 1 + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const active = y === year && m === month;
          return (
            <a
              key={offset}
              href={`/admin/social-photos-settings?year=${y}&month=${m}`}
              className={`rounded-md border px-3 py-1.5 ${
                active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {MONTH_NAMES[m - 1]} {y}
            </a>
          );
        })}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        Hourly staff only — salaried staff aren&apos;t paid extra for this.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Pictures used</th>
              <th className="px-4 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.staffId} className="border-t border-border">
                <td className="px-4 py-2">{row.fullName}</td>
                <td className="px-4 py-2">{row.pictureCount}</td>
                <td className="px-4 py-2 font-medium">£{row.amount.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                  No pictures marked used this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
