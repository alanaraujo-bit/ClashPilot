/**
 * Fingerprint dos assets do jogo.
 *
 * Cada atualização do Clash of Clans publica um novo fingerprint, e a URL do CDN o embute.
 * Trocar este valor e rodar `pnpm --filter @clashpilot/coc-data build:catalog` é o
 * procedimento completo de atualização do catálogo a cada balance update
 * (docs/09-roadmap.md, tarefa recorrente da Fase 3).
 *
 * Pode ser sobrescrito por `COC_ASSET_FINGERPRINT` para testar uma versão nova sem commit.
 */
export const GAME_FINGERPRINT =
  process.env["COC_ASSET_FINGERPRINT"] ?? "c1dd37dcad3d77e0678a1ce2319225ede9a6b821";
