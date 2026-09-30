"use client";

import { PageError } from "@/components/page-error";
import { SocialPhotoPostForm } from "@/components/social-photo-post-form";
import { SocialPhotoIncentive } from "@/components/social-photo-incentive";
import { createPostAction } from "./actions";

export default function NewSocialPhotoPostPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Submit photos for socials</h1>
      <SocialPhotoIncentive />
      <PageError />
      <SocialPhotoPostForm action={createPostAction} />
    </div>
  );
}
