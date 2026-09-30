"use client";

import type { views } from "@/lib/views/admin-people";
import { viewHooks } from "@/lib/client/view";

export const { useView: usePeopleView } = viewHooks<typeof views>("admin-people");
