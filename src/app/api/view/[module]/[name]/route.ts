import type { NextRequest } from "next/server";
import { VIEW_MODULES } from "@/lib/views/registry";

// Serves every screen's data to the browser cache — see src/lib/views/types.ts.
// /api is outside the proxy's sign-in redirect, so each loader's own
// requireUser()/requireAdmin() is the gate; a redirect() or notFound() it
// throws is handed back as JSON for the browser to act on, rather than a 307
// the fetch would silently follow into an HTML page.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest, ctx: { params: Promise<{ module: string; name: string }> }) {
  const { module, name } = await ctx.params;
  const views = VIEW_MODULES[module] as Record<string, (p: Record<string, string>) => Promise<unknown>> | undefined;
  const loader = views && Object.hasOwn(views, name) ? views[name] : undefined;
  if (!loader) {
    return Response.json({ error: "Unknown view" }, { status: 404, headers: NO_STORE });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  try {
    const data = await loader(params);
    return Response.json({ data: data ?? null }, { headers: NO_STORE });
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string") {
      // NEXT_REDIRECT;<replace|push>;<url>;<status>;
      if (digest.startsWith("NEXT_REDIRECT")) {
        return Response.json({ redirect: digest.split(";")[2] || "/" }, { headers: NO_STORE });
      }
      if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) {
        return Response.json({ notFound: true }, { headers: NO_STORE });
      }
    }
    console.error(`view ${module}/${name} failed`, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Couldn't load this page" },
      { status: 500, headers: NO_STORE },
    );
  }
}
