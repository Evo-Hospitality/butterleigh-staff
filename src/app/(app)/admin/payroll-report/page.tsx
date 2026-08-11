import { requireAdmin } from "@/lib/auth";
import { buildPayrollReport } from "@/lib/holiday/payroll-report";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function PayrollReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const rows = await buildPayrollReport(supabase, year, month);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">
          Payroll report — {MONTH_NAMES[month - 1]} {year}
        </h1>
        <a
          href={`/admin/payroll-report/csv?year=${year}&month=${month}`}
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
              href={`/admin/payroll-report?year=${y}&month=${m}`}
              className={`rounded-md border px-3 py-1.5 ${
                active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {MONTH_NAMES[m - 1]} {y}
            </a>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Hours worked</th>
              <th className="px-4 py-2 font-medium">Accrued this month</th>
              <th className="px-4 py-2 font-medium">Holiday taken</th>
              <th className="px-4 py-2 font-medium">Unpaid leave</th>
              <th className="px-4 py-2 font-medium">Lieu earned</th>
              <th className="px-4 py-2 font-medium">Remaining balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.staffId} className="border-t border-border">
                <td className="px-4 py-2 whitespace-nowrap">{row.fullName}</td>
                <td className="px-4 py-2 capitalize">{row.employmentType}</td>
                <td className="px-4 py-2">{row.hoursWorkedThisMonth ?? "—"}</td>
                <td className="px-4 py-2">{row.accruedThisMonth?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-2">
                  {row.holidayTakenThisMonth} {row.unit}
                </td>
                <td className="px-4 py-2">
                  {row.employmentType === "salaried" ? `${row.unpaidLeaveThisMonth} days` : "—"}
                </td>
                <td className="px-4 py-2">{row.employmentType === "salaried" ? row.lieuEarnedThisMonth : "—"}</td>
                <td className="px-4 py-2 font-medium">
                  {row.remainingBalance.toFixed(2)} {row.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
