"use client";

import { useEffect } from "react";
import { useForgetData } from "@/lib/client/providers";

// Arriving at the sign-in page means nobody is signed in on this browser, so
// any saved copy of the previous person's data goes.
export function ForgetCachedData() {
  const forget = useForgetData();
  useEffect(() => forget(), [forget]);
  return null;
}
