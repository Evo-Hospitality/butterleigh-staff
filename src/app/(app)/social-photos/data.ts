"use client";

import type { views } from "@/lib/views/social-photos";
import { viewHooks } from "@/lib/client/view";

export const { useView: useSocialPhotosView } = viewHooks<typeof views>("social-photos");
