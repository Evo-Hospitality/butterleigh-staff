import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestLieuDay } from "./actions";

export default async function RequestLieuDayPage() {
  const { profile } = await requireUser();

  if (profile.employment_type !== "salaried") {
    redirect("/holiday");
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Request a day in lieu</h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Use this when you&apos;ve been asked to work on a day outside your normal working days (for
        example, a bank holiday Monday when you don&apos;t usually work Mondays). Once approved, it
        adds a day to your holiday allowance for the year.
      </p>

      <form action={requestLieuDay} className="flex max-w-md flex-col gap-4">
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
        <button
          type="submit"
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Submit request
        </button>
      </form>
    </div>
  );
}
