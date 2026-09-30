"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageError } from "@/components/page-error";
import Loading from "../../../loading";
import { usePeopleView } from "../../people-data";
import { EditStaffForm } from "./edit-form";

export default function EditStaffPage() {
  const { id } = useParams<{ id: string }>();
  const view = usePeopleView("editStaff", { id });
  if (view.notFound) return <p className="text-sm text-muted-foreground">Staff member not found.</p>;
  if (!view.data) return <Loading />;
  const { staff, managers, hasDetails, currentAdminId } = view.data;

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

      <PageError className="mb-4 max-w-lg" />
      {/* Keyed on the saved record: the form's fields start from it, so if
          the background refresh brings a newer copy than the cached one the
          form is redrawn from that rather than saving stale values back. */}
      <EditStaffForm
        key={JSON.stringify(staff)}
        staff={staff}
        managers={managers}
        currentAdminId={currentAdminId}
      />
    </div>
  );
}
