"use client";

import Link from "next/link";
import { StaffTables } from "@/components/staff-tables";
import Loading from "../../loading";
import { usePeopleView } from "../people-data";

export default function StaffListPage() {
  const view = usePeopleView("staffList");
  if (!view.data) return <Loading />;
  const { active, archived } = view.data;

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

      <StaffTables active={active} archived={archived} />
    </div>
  );
}
