import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pacotes do monorepo são TypeScript cru: o Next os transpila junto com a app.
  transpilePackages: ["@clashpilot/core", "@clashpilot/coc-data"],
  experimental: {
    optimizePackageImports: ["framer-motion", "@tanstack/react-query"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
