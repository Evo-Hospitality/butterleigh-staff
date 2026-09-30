"use client";

import { useState } from "react";
import { useRequire } from "@/lib/client/me";
import { PageError } from "@/components/page-error";
import Loading from "../../../loading";
import { SubmitButton } from "@/components/submit-button";
import { requestLieuDay } from "./actions";

export default function RequestLieuDayPage() {
  // Salaried only — hourly staff have no days in lieu.
  const me = useRequire((m) => m.profile.employment_type === "salaried", "/holiday");
  const [token] = useState(() => crypto.randomUUID());
  if (!me) return <Loading />;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Request a day in lieu</h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Use this when you&apos;ve been asked to work on a day outside your normal working days (for
        example, a bank holiday Monday when you don&apos;t usually work Mondays). Once approved, it
        adds a day to your holiday allowance for the year.
      </p>
      <PageError />

      <form action={requestLieuDay} className="flex max-w-md flex-col gap-4">
        <input type="hidden" name="submission_token" value={token} />
        <div>
          <label className="mb-1 block text-sm font-medium">Date you worked / will work</label>
          <input
            name="work_date"
            type="date"
            required
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton>
      </form>
    </div>
  );
}
