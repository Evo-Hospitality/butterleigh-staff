import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { HolidayStatement } from "@/components/holiday-statement";

// Drill-through behind one figure on the Balances screen, so an admin can
// walk a member of staff through how their holiday built up and where it went.
export default async function BalanceStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { staffId } = await params;
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getFullYear();

  const { data: person } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", staffId)
    .maybeSingle<Pick<Profile, "full_name">>();
  if (!person) notFound();

  return (
    <div>
      <Link href={`/admin/balances?year=${year}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Balances
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">
        {person.full_name} — holiday {year}
      </h1>
      <HolidayStatement
        supabase={supabase}
        staffId={staffId}
        year={year}
        yearHref={(y) => `/admin/balances/${staffId}?year=${y}`}
      />
    </div>
  );
}
