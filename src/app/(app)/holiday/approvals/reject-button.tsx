"use client";

export function RejectButton({ action }: { action: (formData: FormData) => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const reason = window.prompt("Reason for rejecting this request (they'll see this):");
        if (reason === null) {
          e.preventDefault();
          return;
        }
        const input = e.currentTarget.querySelector<HTMLInputElement>('input[name="notes"]');
        if (input) input.value = reason;
      }}
    >
      <input type="hidden" name="notes" />
      <button type="submit" className="text-red-600 hover:underline">
        Reject
      </button>
    </form>
  );
}
