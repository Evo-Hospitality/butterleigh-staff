import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { EditStaffForm } from "./edit-form";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: staff }, { data: managers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single<Profile>(),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
  ]);

  if (!staff) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Edit {staff.full_name}</h1>
      <EditStaffForm staff={staff} managers={managers ?? []} />
    </div>
  );
}
