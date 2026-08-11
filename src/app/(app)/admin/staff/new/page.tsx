import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { StaffForm } from "./staff-form";

export default async function NewStaffPage() {
  const { supabase } = await requireAdmin();

  const { data: managers } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .order("full_name")
    .returns<Profile[]>();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Add staff</h1>
      <StaffForm managers={managers ?? []} />
    </div>
  );
}
