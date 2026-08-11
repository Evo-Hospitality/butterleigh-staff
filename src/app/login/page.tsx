import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { login, requestPasswordResetAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; forgot?: string; sent?: string }>;
}) {
  const { error, forgot, sent } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-8 shadow-sm">
        <Logo className="mx-auto mb-4 h-24 w-24 text-primary" />
        <p className="mb-6 text-center text-sm text-muted-foreground">Staff Portal</p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {forgot === "1" ? (
          <>
            {sent === "1" ? (
              <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                If that email is on our system, a reset link is on its way.
              </p>
            ) : (
              <form action={requestPasswordResetAction} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-accent"
                >
                  Send reset link
                </button>
              </form>
            )}
            <Link href="/login" className="mt-4 block text-center text-sm text-muted-foreground hover:text-accent">
              &larr; Back to sign in
            </Link>
          </>
        ) : (
          <>
            <form action={login} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-accent"
              >
                Sign in
              </button>
            </form>
            <Link
              href="/login?forgot=1"
              className="mt-4 block text-center text-sm text-muted-foreground hover:text-accent"
            >
              Forgot password?
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
