import "server-only";

import { requireCheckinsAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCheckinSummary } from "@/lib/checkins/summary";
import { partitionAgenda } from "@/lib/checkins/agenda";
import type { CheckinGroup, CheckinItem } from "@/lib/types";
import type { ViewMap } from "./types";

export const views = {
  // /checkins — the Overview board: what's outstanding across the other apps,
  // then the meeting agenda. The summary reads through the service-role
  // client, which is why it has to be gathered here rather than in the browser.
  overview: async ({ photoDays: photoDaysParam }) => {
    const { supabase, profile } = await requireCheckinsAccess();
    const isAdmin = profile.role === "admin";
    const photoDays = Math.max(1, Number(photoDaysParam) || 7);

    const [summary, { data: groups }, { data: items }] = await Promise.all([
      buildCheckinSummary(supabase, createAdminClient(), photoDays, isAdmin),
      supabase
        .from("checkin_groups")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .returns<CheckinGroup[]>(),
      supabase.from("checkin_items").select("*").order("created_at").returns<CheckinItem[]>(),
    ]);

    return {
      isAdmin,
      photoDays,
      summary,
      // "Carried to next week" parks an item until UK midnight; anything whose
      // deferral has since passed is simply open again. Worked out at load
      // time — the board refreshes in the background often enough that a
      // parked item reappears within minutes of midnight.
      boardGroups: partitionAgenda(groups ?? [], items ?? []),
    };
  },
} satisfies ViewMap;
