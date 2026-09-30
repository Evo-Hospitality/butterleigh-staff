// The deployment currently live, for open tabs to compare against the one
// their code came from (src/components/version-watcher.tsx). No sign-in
// needed — it's only a build identifier.
export const dynamic = "force-dynamic";

export function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev";
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
