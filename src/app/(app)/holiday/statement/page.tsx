import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { HolidayStatement } from "@/components/holiday-statement";

// A member of staff's own holiday statement — the same view an admin gets
// from Balances, so they can see for themselves how it adds up.
export default async function MyHolidayStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getFullYear();

  return (
    <div>
      <Link href="/holiday" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Holiday
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">My holiday statement — {year}</h1>
      <HolidayStatement
        supabase={supabase}
        staffId={user.id}
        year={year}
        yearHref={(y) => `/holiday/statement?year=${y}`}
        self
      />
    </div>
  );
}
