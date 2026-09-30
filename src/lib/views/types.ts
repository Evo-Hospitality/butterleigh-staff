// A "view" is everything one screen needs to draw, loaded on the server with
// the same permission checks the server-rendered page used to run (requireX,
// RLS, the admin client where a picker needs it), and served as JSON from
// /api/view/<module>/<name>. The browser keeps the result in its cache (see
// src/lib/client/view.ts), so the screen draws instantly next time and
// refreshes quietly in the background.
//
// Rules for a loader:
// - Start with the same requireUser()/requireAdmin()/requireAppAccess() call
//   the page used. redirect() and notFound() inside a loader are passed back
//   to the browser and acted on there.
// - Return plain JSON only — no Map, Set, Date, class instances or functions.
// - Params arrive as strings from the query string (e.g. { year: "2026" }).

export type ViewParams = Record<string, string | undefined>;

export type ViewLoader = (params: ViewParams) => Promise<unknown>;

export type ViewMap = Record<string, ViewLoader>;

/** What a loader resolves to, for typing the browser side. */
export type ViewData<V extends ViewMap, K extends keyof V> = Awaited<ReturnType<V[K]>>;
