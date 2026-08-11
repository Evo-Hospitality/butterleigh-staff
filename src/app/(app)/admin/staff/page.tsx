import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function StaffListPage() {
  const { supabase } = await requireAdmin();

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .returns<Profile[]>();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Staff</h1>
        <Link
          href="/admin/staff/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add staff
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Working days</th>
              <th className="px-4 py-2 font-medium">Allowance</th>
              <th className="px-4 py-2 font-medium">Manager</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Invite</th>
            </tr>
          </thead>
          <tbody>
            {staff?.map((person) => (
              <tr key={person.id} className="border-t border-border">
                <td className="px-4 py-2">
                  <Link href={`/admin/staff/${person.id}`} className="font-medium hover:text-accent">
                    {person.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2 capitalize">{person.employment_type}</td>
                <td className="px-4 py-2">
                  {person.working_days.map((d) => DAY_LABELS[d]).join(", ")}
                </td>
                <td className="px-4 py-2">
                  {person.employment_type === "salaried" ? `${person.annual_allowance_days ?? "—"} days` : "12.07% accrual"}
                </td>
                <td className="px-4 py-2">
                  {staff.find((m) => m.id === person.manager_id)?.full_name ?? "—"}
                </td>
                <td className="px-4 py-2 capitalize">{person.role}</td>
                <td className="px-4 py-2">{person.active ? "Active" : "Archived"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {person.invited_at ? new Date(person.invited_at).toLocaleDateString() : "Not invited"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
