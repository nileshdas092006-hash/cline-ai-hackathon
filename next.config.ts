import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The Cline SDK is a Node host package (dynamic worker URLs, subprocess helpers) that Turbopack
  // cannot bundle; load it with native Node `import` on the server instead.
  serverExternalPackages: ["@cline/sdk", "@cline/core", "@cline/agents", "@cline/llms", "@cline/shared"],
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
