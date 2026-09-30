"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HolidayStatement } from "@/components/holiday-statement";
import Loading from "../../loading";
import { useHolidayView } from "../data";

// A member of staff's own holiday statement — the same view an admin gets
// from Balances, so they can see for themselves how it adds up.
export default function MyHolidayStatementPage() {
  const year = Number(useSearchParams().get("year")) || new Date().getFullYear();
  const view = useHolidayView("statement", { year: String(year) });

  return (
    <div>
      <Link href="/holiday" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Holiday
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">My holiday statement — {year}</h1>
      {view.data ? (
        <HolidayStatement statement={view.data} yearHref={(y) => `/holiday/statement?year=${y}`} self />
      ) : (
        <Loading />
      )}
    </div>
  );
}
