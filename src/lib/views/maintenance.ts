import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireMaintenanceAccess } from "@/lib/auth";
import { staffWithAppAccess } from "@/lib/access-query";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MaintenanceRequest, MaintenanceUpdateEntry, Profile } from "@/lib/types";
import type { ViewMap } from "./types";

// Pickers only need a name against each id — the page used to render these
// on the server, so the rest of each profile never reached the browser.
type Assignee = Pick<Profile, "id" | "full_name">;
const toAssignee = (p: Profile): Assignee => ({ id: p.id, full_name: p.full_name });

export const views = {
  // /maintenance — not started, in progress and closed requests.
  list: async () => {
    const { supabase } = await requireMaintenanceAccess();

    const { data: requests } = await supabase
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<MaintenanceRequest[]>();

    const open = (requests ?? []).filter((r) => r.status === "open");
    const inProgress = (requests ?? []).filter((r) => r.status === "in_progress");
    const closed = (requests ?? []).filter((r) => r.status === "closed");

    // Most recent log entry per open request, surfaced on the row so you can
    // see what's happened lately without opening each one. Open only —
    // activity on a closed request isn't what you're scanning for. Same
    // approach as the Actions list; maintenance_updates RLS already matches
    // maintenance_requests' visibility, so the caller's own client is fine.
    //
    // Status changes are skipped: the section a row sits in already says
    // "in progress", and the note worth scanning is the last real update.
    const openIds = [...open, ...inProgress].map((r) => r.id);
    const latestUpdates: Record<string, MaintenanceUpdateEntry> = {};
    if (openIds.length > 0) {
      const { data: updates } = await supabase
        .from("maintenance_updates")
        .select("*")
        .in("request_id", openIds)
        .neq("kind", "status_changed")
        .order("created_at", { ascending: false })
        .returns<MaintenanceUpdateEntry[]>();
      for (const u of updates ?? []) {
        if (!latestUpdates[u.request_id]) {
          latestUpdates[u.request_id] = u;
        }
      }
    }

    return { open, inProgress, closed, latestUpdates };
  },

  // /maintenance/new — admins pick who it's assigned to.
  newForm: async () => {
    const { profile, supabase } = await requireMaintenanceAccess();
    const isAdmin = profile.role === "admin";

    let assignees: Assignee[] = [];
    if (isAdmin) {
      assignees = (await staffWithAppAccess(supabase, "maintenance", "manage")).map(toAssignee);
    }

    return { isAdmin, assignees };
  },

  // /maintenance/[id] — the request, its log, and the manage panel.
  detail: async ({ id }) => {
    const { supabase, user, profile } = await requireMaintenanceAccess();
    if (!id) notFound();

    const [{ data: request }, { data: updates }] = await Promise.all([
      supabase.from("maintenance_requests").select("*").eq("id", id).single<MaintenanceRequest>(),
      supabase
        .from("maintenance_updates")
        .select("*")
        .eq("request_id", id)
        .order("created_at")
        .returns<MaintenanceUpdateEntry[]>(),
    ]);

    if (!request) {
      notFound();
    }

    const canManage = request.assigned_to === user.id || profile.role === "admin";
    // Wider than canManage: whoever reported it can fix their own wording.
    // Matches edit_maintenance_request()'s check.
    const canEdit =
      request.status !== "closed" &&
      (request.submitted_by === user.id || request.assigned_to === user.id || profile.role === "admin");

    let assignees: Assignee[] = [];
    if (canManage) {
      // Admin client — a non-admin assignee's own RLS-scoped session can't
      // read other people's profiles or access grants (only their own
      // reports), so the list came out short for anyone but an admin.
      assignees = (await staffWithAppAccess(createAdminClient(), "maintenance", "manage"))
        .filter((a) => a.id !== request.assigned_to)
        .map(toAssignee);
    }

    return {
      request,
      updates: updates ?? [],
      canManage,
      canEdit,
      canDelete: profile.role === "admin" && request.status === "closed",
      assignees,
    };
  },

  // /maintenance/[id]/edit — title and description only.
  edit: async ({ id }) => {
    const { supabase, user, profile } = await requireMaintenanceAccess();
    if (!id) notFound();

    const { data: request } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("id", id)
      .single<MaintenanceRequest>();

    if (!request) {
      notFound();
    }

    // Mirrors edit_maintenance_request()'s own check — UX only; the RPC is
    // the real boundary.
    const canEdit =
      request.submitted_by === user.id || request.assigned_to === user.id || profile.role === "admin";
    if (!canEdit || request.status === "closed") {
      redirect(`/maintenance/${id}`);
    }

    return { title: request.title, description: request.description };
  },
} satisfies ViewMap;
