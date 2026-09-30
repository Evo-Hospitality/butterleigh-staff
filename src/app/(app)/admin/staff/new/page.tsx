"use client";

import Loading from "../../../loading";
import { usePeopleView } from "../../people-data";
import { StaffForm } from "./staff-form";

export default function NewStaffPage() {
  const view = usePeopleView("newStaff");
  if (!view.data) return <Loading />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Add staff</h1>
      <StaffForm managers={view.data.managers} />
    </div>
  );
}
