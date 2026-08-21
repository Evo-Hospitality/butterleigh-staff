import { requireUser } from "@/lib/auth";
import { SocialPhotoPostForm } from "@/components/social-photo-post-form";
import { SocialPhotoIncentive } from "@/components/social-photo-incentive";
import { createPostAction } from "./actions";

export default async function NewSocialPhotoPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Submit photos for socials</h1>
      <SocialPhotoIncentive />
      {error && <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <SocialPhotoPostForm action={createPostAction} />
    </div>
  );
}
