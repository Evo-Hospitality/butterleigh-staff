"use client";

export function DeleteSocialPhotoPostButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Permanently delete this submission and all its photos? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        Delete
      </button>
    </form>
  );
}
