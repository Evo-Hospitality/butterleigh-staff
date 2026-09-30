"use client";

import type { views } from "@/lib/views/holiday";
import { viewHooks } from "@/lib/client/view";

export const { useView: useHolidayView } = viewHooks<typeof views>("holiday");
