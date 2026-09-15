// Shared attributes for every cookie this app sets, including Supabase's sign-in cookies.
//
// The app is also opened inside Gus's Launcher (http://localhost:8120), which shows it
// in an iframe on a different site. Browsers only send SameSite=None cookies to a page
// framed like that, so in production cookies are None + Secure; otherwise you sign in
// inside the launcher and are immediately signed out again.
//
// What keeps this safe: next.config.ts only lets this app and the launcher frame it
// (frame-ancestors), and Server Actions reject posts from any other origin.
// Local dev runs on plain http, where Secure cookies can't be set, so it stays Lax.

const production = process.env.NODE_ENV === "production";

export const cookieSite = production
  ? ({ sameSite: "none", secure: true } as const)
  : ({ sameSite: "lax", secure: false } as const);

/** Expire a cookie. A bare delete() omits SameSite, which a framed page can't set. */
export const expiredCookie = { ...cookieSite, path: "/", maxAge: 0 } as const;
