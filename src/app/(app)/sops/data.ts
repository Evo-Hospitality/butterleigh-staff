"use client";

import type { views } from "@/lib/views/sops";
import { viewHooks } from "@/lib/client/view";

export const { useView: useSopsView } = viewHooks<typeof views>("sops");
