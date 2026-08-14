import { requireAdmin } from "@/lib/auth";
import { buildSocialsPayrollReport, socialsPayrollReportToCsv } from "@/lib/social-photos/payroll-report";

export async function GET(request: Request) {
  const { supabase } = await requireAdmin();

  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year")) || now.getFullYear();
  const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;

  const rows = await buildSocialsPayrollReport(supabase, year, month);
  const csv = socialsPayrollReportToCsv(rows, year, month);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="social-photos-payroll-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}
