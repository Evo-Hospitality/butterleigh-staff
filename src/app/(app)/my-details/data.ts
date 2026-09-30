"use client";

import type { views } from "@/lib/views/my-details";
import { viewHooks } from "@/lib/client/view";

export const { useView: useMyDetailsView } = viewHooks<typeof views>("my-details");
