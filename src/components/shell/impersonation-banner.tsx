import { stopImpersonationAction } from "@/app/(app)/actions";

export function ImpersonationBanner({ adminName, targetName }: { adminName: string; targetName: string }) {
  return (
    <div className="flex items-center justify-between bg-yellow-400 px-4 py-2 text-sm font-medium text-yellow-950">
      <span>
        Viewing as <strong>{targetName}</strong>, impersonated by {adminName}
      </span>
      <form action={stopImpersonationAction}>
        <button type="submit" className="underline hover:no-underline">
          Return to my account
        </button>
      </form>
    </div>
  );
}
