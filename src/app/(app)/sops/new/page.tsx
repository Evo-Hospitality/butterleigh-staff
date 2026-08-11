import { requireSopManage } from "@/lib/auth";
import { SopBlockEditor } from "@/components/sop-block-editor";
import { publishAction } from "./actions";

export default async function NewSopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSopManage();
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">New SOP</h1>
      {error && (
        <p className="mb-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <SopBlockEditor
        action={publishAction}
        titleLabel="Title"
        titlePlaceholder="e.g. How to process a refund on the EPOS"
        submitLabel="Publish"
      />
    </div>
  );
}
