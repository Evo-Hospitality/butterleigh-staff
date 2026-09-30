import "server-only";

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadHolidayStatement } from "@/lib/holiday/statement";
import type { ViewMap } from "./types";

export const views = {
  // /admin/balances/[staffId] — one person's holiday statement for a year.
  balanceStatement: async ({ staffId, year }) => {
    const { supabase } = await requireAdmin();
    if (!staffId) notFound();
    const y = Number(year) || new Date().getFullYear();
    const statement = await loadHolidayStatement(supabase, staffId, y);
    if (!statement) notFound();
    return statement;
  },
} satisfies ViewMap;
