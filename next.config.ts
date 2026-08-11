import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB body limit — too small for a phone
    // camera photo. Maintenance photo uploads are separately capped at 5MB
    // in lib/maintenance/storage.ts; this just has to clear that plus the
    // rest of the multipart form.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
