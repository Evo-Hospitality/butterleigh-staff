"use client";

import type { views } from "@/lib/views/admin-settings";
import { viewHooks } from "@/lib/client/view";

export const { useView: useSettingsView } = viewHooks<typeof views>("admin-settings");
