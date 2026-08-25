import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { SocialPhoto, SocialPhotoPost } from "@/lib/types";
import { DeleteSocialPhotoPostButton } from "@/components/delete-social-photo-post-button";
import { SocialPhotoIncentive } from "@/components/social-photo-incentive";
import { deletePostAction, toggleUsedAction } from "./actions";
import { formatDateTime } from "@/lib/format";

export default async function SocialPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, profile, access } = await requireUser();
  const { error } = await searchParams;

  const [{ data: posts }, { data: photos }, { data: settings }] = await Promise.all([
    supabase
      .from("social_photo_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<SocialPhotoPost[]>(),
    supabase.from("social_photos").select("*").order("sort_order").returns<SocialPhoto[]>(),
    supabase.from("settings").select("social_photos_reviewer_id").single(),
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
            </div>
          );
        })}
        {(posts ?? []).length === 0 && <p className="text-sm text-muted-foreground">No photos submitted yet.</p>}
      </div>
    </div>
  );
}
