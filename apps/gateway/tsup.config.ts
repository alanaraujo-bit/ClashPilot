import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Os pacotes do workspace são TypeScript cru — precisam ser embutidos no bundle.
  // Sem isto, o Node tenta carregar `packages/core/src/**.js` em produção e não acha nada.
  noExternal: [/^@clashpilot\//],
});
