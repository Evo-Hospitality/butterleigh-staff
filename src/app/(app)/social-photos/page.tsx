"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/client/me";
import { patchView, useSave } from "@/lib/client/save";
import { PageError } from "@/components/page-error";
import { SubmitButton } from "@/components/submit-button";
import { DeleteSocialPhotoPostButton } from "@/components/delete-social-photo-post-button";
import { SocialPhotoIncentive } from "@/components/social-photo-incentive";
import type { SocialPhotoItem, views } from "@/lib/views/social-photos";
import type { ViewData } from "@/lib/views/types";
import Loading from "../loading";
import { useSocialPhotosView } from "./data";
import { addCommentAction, deleteCommentAction, deletePostAction, toggleUsedAction } from "./actions";
import { formatDateTime } from "@/lib/format";

type Feed = ViewData<typeof views, "feed">;

// Mark used / Undo flips the tick straight away and saves in the background;
// set_photo_used() still does the real permission check, and a refusal puts
// the tick back.
function ToggleUsedButton({ photo }: { photo: SocialPhotoItem }) {
  const save = useSave();
  const target = !photo.used_for_socials;
  return (
    <button
      type="button"
      onClick={() =>
        save(() => toggleUsedAction(photo.id, target), {
          optimistic: (qc) =>
            patchView<Feed>(qc, "social-photos", "feed", (d) => ({
              ...d,
              photosByPost: {
                ...d.photosByPost,
                [photo.post_id]: (d.photosByPost[photo.post_id] ?? []).map((p) =>
                  p.id === photo.id ? { ...p, used_for_socials: target } : p,
                ),
              },
            })),
        })
      }
      className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:border-accent"
    >
      {photo.used_for_socials ? "Undo" : "Mark used"}
    </button>
  );
}

// The token stops a double-tap posting the comment twice. It lasts for this
// visit to the page and is swapped for a fresh one once a comment lands, so
// a second, deliberate comment on the same post still goes through.
function CommentForm({ postId }: { postId: string }) {
  const [token, setToken] = useState(() => crypto.randomUUID());
  return (
    <form
      action={async (formData) => {
        await addCommentAction(postId, formData);
        setToken(crypto.randomUUID());
      }}
      className="flex items-start gap-2"
    >
      <input type="hidden" name="submission_token" value={token} />
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
  );
}

export default function SocialPhotosPage() {
  const { profile, access, isAdmin } = useMe()!;
  const view = useSocialPhotosView("feed");
  if (!view.data) return <Loading />;
  const { posts, photosByPost, commentsByPost } = view.data;

  // Manage on Social photos, same as every other app. Real enforcement is
  // inside set_photo_used() regardless.
  const canMark = access("social_photos", "manage");

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

      <PageError className="mb-4 max-w-lg" />

      <div className="flex flex-col gap-6">
        {posts.map((post) => {
          const postPhotos = photosByPost[post.id] ?? [];
          const deleteAction = deletePostAction.bind(null, post.id);
          const postComments = commentsByPost[post.id] ?? [];
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
                          <ToggleUsedButton photo={photo} />
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
                <CommentForm postId={post.id} />
              </div>
            </div>
          );
        })}
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No photos submitted yet.</p>}
      </div>
    </div>
  );
}
