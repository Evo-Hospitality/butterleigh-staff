import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { SocialPhoto, SocialPhotoComment, SocialPhotoPost } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";
import { DeleteSocialPhotoPostButton } from "@/components/delete-social-photo-post-button";
import { SocialPhotoIncentive } from "@/components/social-photo-incentive";
import { addCommentAction, deleteCommentAction, deletePostAction, toggleUsedAction } from "./actions";
import { formatDateTime } from "@/lib/format";

export default async function SocialPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, profile, access } = await requireUser();
  const { error } = await searchParams;

  const [{ data: posts }, { data: photos }, { data: comments }] = await Promise.all([
    supabase
      .from("social_photo_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<SocialPhotoPost[]>(),
    supabase.from("social_photos").select("*").order("sort_order").returns<SocialPhoto[]>(),
    supabase
      .from("social_photo_comments")
      .select("*")
      .order("created_at")
      .returns<SocialPhotoComment[]>(),
  ]);

  // Manage on Social photos, same as every other app. Real enforcement is
  // inside set_photo_used() regardless.
  const canMark = access("social_photos", "manage");

  const photosByPost = new Map<string, SocialPhoto[]>();
  for (const photo of photos ?? []) {
    const list = photosByPost.get(photo.post_id) ?? [];
    list.push(photo);
    photosByPost.set(photo.post_id, list);
  }

  const commentsByPost = new Map<string, SocialPhotoComment[]>();
  for (const comment of comments ?? []) {
    const list = commentsByPost.get(comment.post_id) ?? [];
    list.push(comment);
    commentsByPost.set(comment.post_id, list);
  }
  const isAdmin = profile.role === "admin";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Photos for socials</h1>
        <Link
          href="/social-photos/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Submit photos
        </Link>
      </div>

      <SocialPhotoIncentive />

      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-col gap-6">
        {(posts ?? []).map((post) => {
          const postPhotos = photosByPost.get(post.id) ?? [];
          const deleteAction = deletePostAction.bind(null, post.id);
          const postComments = commentsByPost.get(post.id) ?? [];
          const commentAction = addCommentAction.bind(null, post.id);
          return (
            <div key={post.id} className="rounded-lg border border-border p-4">
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {post.submitted_by_name} · {formatDateTime(post.created_at)}
                </p>
                {canMark && <DeleteSocialPhotoPostButton action={deleteAction} />}
              </div>
              {post.caption && <p className="mb-3 text-sm">{post.caption}</p>}
              <div className="flex flex-wrap gap-3">
                {postPhotos.map((photo) => {
                  const toggleAction = toggleUsedAction.bind(null, photo.id, !photo.used_for_socials);
                  return (
                    <div key={photo.id} className="w-32">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt=""
                          className="h-32 w-32 rounded-md border border-border object-cover"
                        />
                        {photo.used_for_socials && (
                          <span className="absolute left-1 top-1 rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                            &#10003; Used
                          </span>
                        )}
                      </div>
                      {canMark && (
                        <div className="mt-1 flex flex-col gap-1">
                          <a
                            href={`${photo.url}?download`}
                            className="block w-full rounded-md border border-border bg-white px-2 py-1 text-center text-xs font-medium hover:border-accent"
                          >
                            Download
                          </a>
                          <form action={toggleAction}>
                            <button
                              type="submit"
                              className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:border-accent"
                            >
                              {photo.used_for_socials ? "Undo" : "Mark used"}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-border pt-3">
                {postComments.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {postComments.map((c) => (
                      <li key={c.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                        <div className="mb-0.5 flex items-start justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-primary">{c.author_name}</span> ·{" "}
                            {formatDateTime(c.created_at)}
                          </p>
                          {(c.author_id === profile.id || isAdmin) && (
                            <form action={deleteCommentAction.bind(null, c.id)}>
                              <button type="submit" className="text-xs text-muted-foreground hover:text-red-700">
                                Delete
                              </button>
                            </form>
                          )}
                        </div>
                        <p className="whitespace-pre-line">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={commentAction} className="flex items-start gap-2">
                  <input type="hidden" name="submission_token" value={crypto.randomUUID()} />
                  <textarea
                    name="body"
                    required
                    rows={1}
                    maxLength={2000}
                    placeholder="Add a comment…"
                    className="min-h-9 flex-1 rounded-md border border-border px-3 py-1.5 text-sm"
                  />
                  <SubmitButton
                    pendingLabel="Posting…"
                    className="rounded-md border border-accent px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    Comment
                  </SubmitButton>
                </form>
              </div>
            </div>
          );
        })}
        {(posts ?? []).length === 0 && <p className="text-sm text-muted-foreground">No photos submitted yet.</p>}
      </div>
    </div>
  );
}
