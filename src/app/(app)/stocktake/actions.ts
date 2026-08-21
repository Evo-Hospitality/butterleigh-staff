"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StockTakeStatus, StockType } from "@/lib/types";

export type SaveStockTakeResult = { ok: true; id: string } | { ok: false; error: string };

// Called directly from the grid's client component (not a <form action> —
// the items x locations payload doesn't fit flat form fields cleanly), so
// this returns a result object rather than throwing/redirecting itself;
// the client navigates on success. save_stock_take() (0024_stocktake.sql)
// is the one write path for both "save as draft" and "submit".
export async function saveStockTakeAction(payload: {
  stockTakeId: string | null;
  type: StockType;
  status: StockTakeStatus;
  stockDate: string;
  notes: string;
  submissionToken?: string | null;
  entries: {
    stockItemId: string | null;
    groupName: string;
    name: string;
    unit: string;
    unitPrice: number | null;
    quantities: { locationId: string; quantity: number }[];
  }[];
}): Promise<SaveStockTakeResult> {
  const { supabase } = await requireUser();

  if (!payload.stockDate) {
    return { ok: false, error: "Pick the stocktake date." };
  }
  if (payload.entries.length === 0) {
    return { ok: false, error: "Add at least one item." };
  }

  const { data, error } = await supabase.rpc("save_stock_take", {
    p_stock_take_id: payload.stockTakeId,
    p_type: payload.type,
    p_status: payload.status,
    p_stock_date: payload.stockDate,
    p_notes: payload.notes.trim() || null,
    // Only consulted when creating a new stocktake — resuming a draft
    // already targets a specific id, so it can't duplicate.
    p_submission_token: payload.submissionToken ?? null,
    p_entries: payload.entries.map((e) => ({
      stock_item_id: e.stockItemId,
      group_name: e.groupName,
      name: e.name,
      unit: e.unit.trim() || null,
      unit_price: e.unitPrice,
      // Must be snake_case too — the RPC reads location_id out of this
      // JSON, and a camelCase key silently reads as null there.
      quantities: e.quantities.map((q) => ({ location_id: q.locationId, quantity: q.quantity })),
    })),
  });

  if (error) {
    return { ok: false, error: error.message || "Failed to save." };
  }

  revalidatePath("/stocktake");
  return { ok: true, id: data as string };
}

export type AddUnitResult = { ok: true; name: string } | { ok: false; error: string };

// Adding a unit mid-stocktake, straight from the row's dropdown. Unlike
// stock_items, stock_units is just a lookup list with no audit trail to
// bypass, so this is a plain insert rather than going through the RPC. It
// persists immediately (not deferred to submit) so it's available to
// everyone, including anyone else counting at the same time.
export async function addStockUnitAction(type: StockType, name: string): Promise<AddUnitResult> {
  const { supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a unit name." };
  }

  const { data: existing } = await supabase
    .from("stock_units")
    .select("sort_order")
    .eq("type", type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("stock_units")
    .insert({ type, name: trimmed, sort_order: (existing?.sort_order ?? -1) + 1 });

  // A duplicate is harmless here — the unit the user asked for now exists
  // either way, which is all they care about.
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }

  return { ok: true, name: trimmed };
}

// Abandoning a draft — a plain delete, RLS-scoped to status = 'draft'
// (stock_takes_delete_draft policy), open to anyone.
export async function deleteStockTakeDraftAction(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("stock_takes").delete().eq("id", id).eq("status", "draft");
  revalidatePath("/stocktake");
}

// Admin-only, no restriction on age/content — mirrors Events'/Photos'
// delete pattern. Uses the service-role client since RLS has no delete
// policy for submitted records (only the draft one above).
export async function deleteSubmittedStockTakeAction(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("stock_takes").delete().eq("id", id);
  revalidatePath("/stocktake");
  redirect("/stocktake");
}
