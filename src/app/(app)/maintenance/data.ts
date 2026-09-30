"use client";

import type { views } from "@/lib/views/maintenance";
import { viewHooks } from "@/lib/client/view";

export const { useView: useMaintenanceView } = viewHooks<typeof views>("maintenance");
