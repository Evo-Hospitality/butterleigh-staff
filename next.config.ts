import type { NextConfig } from "next";

// Which deployment this browser code came from — compared against
// /api/version so an open tab can tell a newer version has gone live (see
// src/components/version-watcher.tsx). Same expression as that route.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  experimental: {
    // Server Actions default to a 1MB body limit — too small for a phone
    // camera photo. Maintenance photo uploads are separately capped at
    // 15MB in lib/maintenance/storage.ts; this just has to clear that plus
    // the rest of the multipart form. (SOPs/Events photos don't go through
    // this at all — they upload directly to storage from the browser.)
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Keep recently visited pages in the browser so going back to them is
    // instant (any save still refreshes them via revalidatePath).
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  // Only this app itself and Gus's Launcher (a local app on port 8120) may show it
  // inside a frame. Blocks other sites from framing it now that cookies are
  // SameSite=None (see src/lib/cookie-options.ts).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:8120 http://127.0.0.1:8120",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
