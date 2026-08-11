"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function addBankHoliday(formData: FormData) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("bank_holidays").insert({
    date: String(formData.get("date")),
    name: String(formData.get("name")),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/bank-holidays");
}

export async function deleteBankHoliday(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("bank_holidays").delete().eq("id", id);
  revalidatePath("/admin/bank-holidays");
}
