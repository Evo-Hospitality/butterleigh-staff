import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireActionItemsAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManagerOrAdmin, type ActionItem, type ActionItemUpdateEntry, type Profile } from "@/lib/types";
import type { ViewMap } from "./types";

export type ActionAssignee = Pick<Profile, "id" | "full_name">;

// Admin client — profiles' own RLS only lets a non-admin manager see
// themselves and their direct reports, not the wider manager/admin pool the
// "Assign to" pickers need (same reasoning as lib/maintenance/routing.ts's
// resolveDefaultAssignee()). Only names go to the browser.
async function loadManagerPool(): Promise<ActionAssignee[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("active", true)
    .order("full_name")
    .returns<Profile[]>();
  return (data ?? []).filter(isManagerOrAdmin).map((p) => ({ id: p.id, full_name: p.full_name }));
}

export const views = {
  // /actions — RLS already scopes this to Actions where the caller is the
  // submitter, the assignee, or an admin.
  list: async () => {
    const { supabase } = await requireActionItemsAccess();

    const { data: items } = await supabase
      .from("action_items")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ActionItem[]>();
    const all = items ?? [];

    // Latest update on each open or in-progress Action, shown under its
    // title. Status changes are skipped — the section says that already.
    const openIds = all.filter((a) => a.status !== "closed").map((a) => a.id);
    const latestUpdates: Record<string, Pick<ActionItemUpdateEntry, "author_name" | "note">> = {};
    if (openIds.length > 0) {
      const { data: updates } = await supabase
        .from("action_item_updates")
        .select("*")
        .in("action_id", openIds)
        .neq("kind", "status_changed")
        .order("created_at", { ascending: false })
        .returns<ActionItemUpdateEntry[]>();
      for (const u of updates ?? []) {
        if (!latestUpdates[u.action_id]) {
          latestUpdates[u.action_id] = { author_name: u.author_name, note: u.note };
        }
      }
    }

    return { items: all, latestUpdates };
  },

  // /actions/new — everyone who can reach it is already a manager/admin, so
  // the "Assign to" dropdown always shows.
  newForm: async () => {
    await requireActionItemsAccess();
    return { assignees: await loadManagerPool() };
  },

  // /actions/[id] — the Action, its log, and (for whoever can manage it)
  // the people it could be reassigned to.
  detail: async ({ id }) => {
    const { supabase, user, profile } = await requireActionItemsAccess();
    if (!id) notFound();

    const [{ data: action }, { data: updates }] = await Promise.all([
      supabase.from("action_items").select("*").eq("id", id).single<ActionItem>(),
      supabase
        .from("action_item_updates")
        .select("*")
        .eq("action_id", id)
        .order("created_at")
        .returns<ActionItemUpdateEntry[]>(),
    ]);
    if (!action) notFound();

    const canManage = action.assigned_to === user.id || profile.role === "admin";
    const assignees = canManage
      ? (await loadManagerPool()).filter((a) => a.id !== action.assigned_to)
      : [];

    return { action, updates: updates ?? [], assignees };
  },

  // /actions/[id]/edit — mirrors edit_action_item()'s own check, for the UX
  // (don't show a form that's going to be refused); the RPC is the real
  // boundary.
  edit: async ({ id }) => {
    const { supabase, user, profile } = await requireActionItemsAccess();
    if (!id) notFound();

    const { data: action } = await supabase.from("action_items").select("*").eq("id", id).single<ActionItem>();
    if (!action) notFound();

    const canEdit =
      action.submitted_by === user.id || action.assigned_to === user.id || profile.role === "admin";
    if (!canEdit || action.status === "closed") {
      redirect(`/actions/${id}`);
    }

    return { title: action.title, notes: action.notes };
  },
} satisfies ViewMap;
