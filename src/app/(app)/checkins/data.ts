"use client";

import type { views } from "@/lib/views/checkins";
import { viewHooks } from "@/lib/client/view";

export const { useView: useCheckinsView } = viewHooks<typeof views>("checkins");
