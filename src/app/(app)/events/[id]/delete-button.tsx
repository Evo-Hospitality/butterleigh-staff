"use client";

export function DeleteSuggestionButton({
  title,
  action,
}: {
  title: string;
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete "${title}"? This also removes its photos. This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Delete suggestion
      </button>
    </form>
  );
}
