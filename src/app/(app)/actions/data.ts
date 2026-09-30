"use client";

import type { views } from "@/lib/views/actions";
import { viewHooks } from "@/lib/client/view";

export const { useView: useActionsView } = viewHooks<typeof views>("actions");
