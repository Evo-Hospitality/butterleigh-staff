import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB body limit — too small for a phone
    // camera photo. Maintenance photo uploads are separately capped at
    // 15MB in lib/maintenance/storage.ts; this just has to clear that plus
    // the rest of the multipart form. (SOPs/Events photos don't go through
    // this at all — they upload directly to storage from the browser.)
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
