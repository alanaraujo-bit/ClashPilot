import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * A âncora do file tracing precisa ser a raiz do monorepo: sem isso, o Next não copia
   * nada de fora de `apps/web` para a função serverless.
   */
  outputFileTracingRoot: repoRoot,
  // Pacotes do monorepo são TypeScript cru: o Next os transpila junto com a app.
  // `@clashpilot/db` entra aqui porque o client do Prisma agora é TypeScript gerado
  // (generator `prisma-client`) — precisa ser transpilado, não tratado como pacote externo.
  transpilePackages: [
    "@clashpilot/core",
    "@clashpilot/coc-data",
    "@clashpilot/contracts",
    "@clashpilot/db",
  ],
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
