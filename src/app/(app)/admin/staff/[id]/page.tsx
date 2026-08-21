import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { EmployeeDetails, Profile } from "@/lib/types";
import { EditStaffForm } from "./edit-form";

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await requireAdmin();

  const [{ data: staff }, { data: managers }, { data: details }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single<Profile>(),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase.from("employee_details").select("*").eq("staff_id", id).maybeSingle<EmployeeDetails>(),
  ]);

  if (!staff) {
    notFound();
  }

  const hasDetails = !!(details?.home_address || details?.ni_number || details?.bank_account_number);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Edit {staff.full_name}</h1>

      {/* This page is about how they're set up in the portal; their payroll
          record lives on its own screen, and this is where you'd come
          looking for it. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
        <p className="text-sm">
          <span className="font-semibold text-primary">Employment details</span>{" "}
          <span className="text-muted-foreground">
            — home address, date of birth, National Insurance number, emergency contact and bank
            details.{" "}
            {hasDetails ? "On file." : "Nothing on file yet."}
          </span>
        </p>
        <Link
          href={`/admin/onboarding/${staff.id}`}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {hasDetails ? "View / edit" : "Add them"}
        </Link>
      </div>

      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <EditStaffForm staff={staff} managers={managers ?? []} currentAdminId={user.id} />
    </div>
  );
}
