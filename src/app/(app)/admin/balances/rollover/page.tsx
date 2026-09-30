"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RolloverForm } from "@/components/rollover-form";
import { commitRolloverAction } from "./actions";
import Loading from "../../../loading";
import { useSettingsView } from "../../settings-data";

export default function RolloverPage() {
  const from = Number(useSearchParams().get("from")) || new Date().getFullYear();
  const view = useSettingsView("rollover", { from: String(from) });
  if (!view.data) return <Loading />;

  const { fromYear, toYear, rows } = view.data;

  return (
    <div>
      <Link href={`/admin/balances?year=${fromYear}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Balances
      </Link>

      <h1 className="mt-2 mb-2 text-2xl font-bold text-primary">
        Roll {fromYear} into {toYear}
      </h1>

      <div className="mb-6 max-w-2xl text-sm text-muted-foreground">
        <p className="mb-2">
          Sets up the {toYear} leave year. Check the figures and change any of them before
          committing — nothing is written until you do.
        </p>
        <p className="mb-2">
          <strong>Salaried</strong> default to an opening balance of zero, because the allowance
          column is their entitlement for {toYear} and carrying the old balance across as well would
          count it twice. <strong>Hourly</strong> default to carrying their full unused balance,
          since accrued holiday they haven&apos;t taken is still owed to them.
        </p>
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-yellow-900">
          Worth doing before January: approving a holiday request fails outright if the person has
          no balance row for that year, so until this is run nobody&apos;s {toYear} leave can be
          approved.
        </p>
      </div>

      <RolloverForm key={fromYear} fromYear={fromYear} toYear={toYear} rows={rows} commitAction={commitRolloverAction} />
    </div>
  );
}
