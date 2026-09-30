"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastItem } from "@/lib/client/toast";

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto max-w-md rounded-lg px-4 py-2 text-sm shadow-lg ${
            t.kind === "error" ? "bg-red-600 text-white" : "bg-primary text-white"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
