import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Prisma em monorepo pnpm na Vercel.
   *
   * O engine nativo (`libquery_engine-*.so.node`) não é um import: o webpack não o vê e o
   * file tracing padrão, ancorado em `apps/web`, não olha para fora da pasta. Resultado:
   * função sobe sem o engine e todo acesso ao banco vira PrismaClientInitializationError.
   *
   * `outputFileTracingRoot` move a âncora para a raiz do monorepo e `outputFileTracingIncludes`
   * copia o client gerado junto com a função.
   */
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": ["../../packages/db/generated/client/**"],
  },
  serverExternalPackages: ["@prisma/client", "@clashpilot/db"],
  // Pacotes do monorepo são TypeScript cru: o Next os transpila junto com a app.
  transpilePackages: ["@clashpilot/core", "@clashpilot/coc-data", "@clashpilot/contracts"],
  experimental: {
    optimizePackageImports: ["framer-motion", "@tanstack/react-query"],
  },
  /**
   * O código dos pacotes importa com extensão `.js` (padrão ESM/NodeNext), mas os arquivos
   * são `.ts`. Turbopack e tsc resolvem isso sozinhos; o webpack do build de produção não.
   * Sem este alias, `Module not found: Can't resolve './townhall.js'`.
   */
  webpack: (config: { resolve: { extensionAlias?: Record<string, string[]> } }) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
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
