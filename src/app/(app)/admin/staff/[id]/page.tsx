import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
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
      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <EditStaffForm staff={staff} managers={managers ?? []} />
    </div>
  );
}
