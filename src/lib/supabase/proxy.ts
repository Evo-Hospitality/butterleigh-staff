import { createServerClient } from "@supabase/ssr";
import { cookieSite } from "@/lib/cookie-options";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/auth/"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieSite,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims verifies the sign-in token locally against the project's public
  // signing key (ES256; refreshing it first if it has expired) — no round trip
  // to the Supabase auth server on every page load, unlike getUser.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isPublicPath =
    PUBLIC_PATHS.includes(request.nextUrl.pathname) ||
    PUBLIC_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Only bounce authenticated users away from /login — NOT away from
  // /auth/* (callback, set-password). Someone who just landed via an
  // invite/recovery link IS "authenticated" (a temporary session) but still
  // needs to reach /auth/set-password, not get redirected past it.
  if (user && PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
