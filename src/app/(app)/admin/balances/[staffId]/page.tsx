"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { HolidayStatement } from "@/components/holiday-statement";
import Loading from "../../../loading";
import { useAdminView } from "../../data";

// Drill-through behind one figure on the Balances screen, so an admin can
// walk a member of staff through how their holiday built up and where it went.
export default function BalanceStatementPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const year = Number(useSearchParams().get("year")) || new Date().getFullYear();
  const view = useAdminView("balanceStatement", { staffId, year: String(year) });

  return (
    <div>
      <Link href={`/admin/balances?year=${year}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Balances
      </Link>
      {view.notFound ? (
        <p className="mt-4 text-sm text-muted-foreground">Staff member not found.</p>
      ) : view.data ? (
        <>
          <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">
            {view.data.person.full_name} — holiday {year}
          </h1>
          <HolidayStatement
            statement={view.data}
            yearHref={(y) => `/admin/balances/${staffId}?year=${y}`}
          />
        </>
      ) : (
        <Loading />
      )}
    </div>
  );
}
