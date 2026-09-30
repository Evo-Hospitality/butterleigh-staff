"use client";

// Tiny global toast bus (rendered by <Toaster/> in the providers).

export type ToastKind = "ok" | "error";
export interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<(t: ToastItem[]) => void>();

function emit() {
  for (const s of subs) s(items);
}

export function toast(text: string, kind: ToastKind = "ok") {
  const id = ++seq;
  items = [...items, { id, text, kind }].slice(-4);
  emit();
  setTimeout(
    () => {
      items = items.filter((t) => t.id !== id);
      emit();
    },
    kind === "error" ? 8000 : 3500,
  );
}

export function subscribeToasts(fn: (t: ToastItem[]) => void) {
  subs.add(fn);
  fn(items);
  return () => {
    subs.delete(fn);
  };
}
