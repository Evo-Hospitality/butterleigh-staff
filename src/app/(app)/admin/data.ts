"use client";

import type { views } from "@/lib/views/admin";
import { viewHooks } from "@/lib/client/view";

export const { useView: useAdminView } = viewHooks<typeof views>("admin");
