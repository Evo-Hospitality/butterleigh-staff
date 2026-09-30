"use client";

import type { views } from "@/lib/views/tasks";
import { viewHooks } from "@/lib/client/view";

export const { useView: useTasksView } = viewHooks<typeof views>("tasks");
