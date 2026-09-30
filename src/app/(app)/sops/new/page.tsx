"use client";

import { useRequire } from "@/lib/client/me";
import { PageError } from "@/components/page-error";
import Loading from "../../loading";
import { SopBlockEditor } from "@/components/sop-block-editor";
import { publishAction, saveDraftAction } from "./actions";

export default function NewSopPage() {
  const me = useRequire((m) => m.access("sops", "manage"));
  if (!me) return <Loading />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">New SOP</h1>
      <PageError className="mb-4 max-w-2xl" />
      <SopBlockEditor
        publishAction={publishAction}
        publishLabel="Publish"
        draftAction={saveDraftAction}
        titleLabel="Title"
        titlePlaceholder="e.g. How to process a refund on the EPOS"
      />
    </div>
  );
}
