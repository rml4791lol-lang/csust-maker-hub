import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.AI_ASSOCIATION_BUILD_DIR || ".next",
  // Preserve the actual loopback origin for login redirects and CSRF checks.
  skipProxyUrlNormalize: true,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
