"use client";

import { useMe } from "@/lib/client/me";
import { PageError } from "@/components/page-error";
import { RequestForm } from "./request-form";

export default function RequestHolidayPage() {
  const { profile } = useMe()!;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Request holiday</h1>
      <PageError />
      <RequestForm profile={profile} />
    </div>
  );
}
