import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { temporaryLink } from "@/lib/dropbox";

// "Open video": anyone signed in can watch a submitted video (the feed is
// open to all staff). Dropbox gives a 4-hour link to the file; nothing about
// the Dropbox account is exposed.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireUser();
  const { id } = await ctx.params;

  const { data: photo } = await supabase
    .from("social_photos")
    .select("kind, dropbox_path")
    .eq("id", id)
    .maybeSingle<{ kind: string; dropbox_path: string | null }>();
  if (!photo || photo.kind !== "video" || !photo.dropbox_path) {
    return new Response("Video not found", { status: 404 });
  }

  try {
    return NextResponse.redirect(await temporaryLink(photo.dropbox_path));
  } catch {
    return new Response("Couldn't fetch that video from Dropbox — it may have been moved or deleted there.", { status: 502 });
  }
}
