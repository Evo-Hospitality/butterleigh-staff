"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { StockType } from "@/lib/types";

export async function addStockLocation(type: StockType, formData: FormData) {
  const { supabase } = await requireAdmin();

  const { data: existing } = await supabase
    .from("stock_locations")
    .select("sort_order")
    .eq("type", type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("stock_locations").insert({
    type,
    name: String(formData.get("name")),
    sort_order: (existing?.sort_order ?? -1) + 1,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/stock-locations");
}

export async function deleteStockLocation(id: string, type: StockType) {
  const { supabase } = await requireAdmin();
  await supabase.from("stock_locations").delete().eq("id", id);
  revalidatePath(`/admin/stock-locations?type=${type}`);
}
