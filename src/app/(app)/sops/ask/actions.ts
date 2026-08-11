"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

function fail(message: string): never {
  redirect(`/sops/ask?error=${encodeURIComponent(message)}`);
}

export async function askQuestionAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    fail("Enter your question.");
  }

  const { data: entry, error } = await supabase
    .from("sop_entries")
    .insert({
      title,
      asked_by: user.id,
      asked_by_name: profile.full_name,
      status: "unanswered",
    })
    .select()
    .single();

  if (error || !entry) {
    fail(error?.message ?? "Failed to submit your question.");
  }

  redirect(`/sops/${entry.id}`);
}
