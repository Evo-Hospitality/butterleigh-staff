import "server-only";

import { requireUser } from "@/lib/auth";
import type { SocialPhoto, SocialPhotoComment, SocialPhotoPost } from "@/lib/types";
import type { ViewMap } from "./types";

export type SocialPhotoItem = Pick<SocialPhoto, "id" | "post_id" | "url" | "used_for_socials">;

export const views = {
  // /social-photos — every submission with its photos and comments.
  feed: async () => {
    const { supabase } = await requireUser();

    const [{ data: posts }, { data: photos }, { data: comments }] = await Promise.all([
      supabase
        .from("social_photo_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<SocialPhotoPost[]>(),
      supabase.from("social_photos").select("*").order("sort_order").returns<SocialPhoto[]>(),
      // An error here (e.g. the comments table not migrated yet) is ignored
      // and simply shows no comments — the feed itself must still load.
      supabase
        .from("social_photo_comments")
        .select("*")
        .order("created_at")
        .returns<SocialPhotoComment[]>(),
    ]);

    const photosByPost: Record<string, SocialPhotoItem[]> = {};
    for (const photo of photos ?? []) {
      (photosByPost[photo.post_id] ??= []).push({
        id: photo.id,
        post_id: photo.post_id,
        url: photo.url,
        used_for_socials: photo.used_for_socials,
      });
    }

    const commentsByPost: Record<string, SocialPhotoComment[]> = {};
    for (const comment of comments ?? []) {
      (commentsByPost[comment.post_id] ??= []).push(comment);
    }

    return {
      posts: (posts ?? []).map((p) => ({
        id: p.id,
        submitted_by_name: p.submitted_by_name,
        caption: p.caption,
        created_at: p.created_at,
      })),
      photosByPost,
      commentsByPost,
    };
  },
} satisfies ViewMap;
