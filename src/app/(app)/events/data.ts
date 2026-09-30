"use client";

import type { views } from "@/lib/views/events";
import { viewHooks } from "@/lib/client/view";

export const { useView: useEventsView } = viewHooks<typeof views>("events");
