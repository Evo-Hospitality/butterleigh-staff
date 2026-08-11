import { requireAdmin } from "@/lib/auth";
import type { BankHoliday } from "@/lib/types";
import { addBankHoliday, deleteBankHoliday } from "./actions";

export default async function BankHolidaysPage() {
  const { supabase } = await requireAdmin();

  const { data: holidays } = await supabase
    .from("bank_holidays")
    .select("*")
    .order("date")
    .returns<BankHoliday[]>();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Bank holidays</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Reference calendar only — bank holidays are normal working days, so this doesn&apos;t affect
        anyone&apos;s balance automatically. It just gives admins context when reviewing day-in-lieu
        requests.
      </p>

      <form action={addBankHoliday} className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            name="date"
            type="date"
            required
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            name="name"
            required
            placeholder="e.g. Early May bank holiday"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {holidays?.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-4 py-2">{h.date}</td>
                <td className="px-4 py-2">{h.name}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteBankHoliday.bind(null, h.id)}>
                    <button type="submit" className="text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
