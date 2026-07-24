import { GENERATED_API_ALIASES, GENERATED_CATALOG } from "./generated/catalog.js";
import { toKey } from "./classification.js";
import type { CatalogEntry, TownHallLevel } from "./types.js";

/**
 * Catálogo do jogo: custo, tempo e Centro de Vila mínimo de cada nível.
 *
 * Gerado a partir dos arquivos de lógica oficiais do Clash of Clans (o mesmo CDN que o jogo
 * usa), nunca digitado à mão. Regenerar após um balance update:
 *
 *     pnpm --filter @clashpilot/coc-data build:catalog
 *
 * Os valores estão travados por testes de integridade em `catalog.test.ts` — se a Supercell
 * mudar a semântica dos arquivos, o CI quebra antes de o número errado chegar ao usuário.
 */
export const CATALOG: readonly CatalogEntry[] = GENERATED_CATALOG;

export type Catalog = readonly CatalogEntry[];

export function findEntry(catalog: Catalog, key: string): CatalogEntry | undefined {
  return catalog.find((e) => e.key === key);
}

/**
 * Chave do catálogo para uma unidade vinda da API oficial.
 *
 * A API usa nomes de exibição (`Lightning Spell`, `Minion`); o catálogo, chaves derivadas dos
 * nomes internos dos arquivos (`lighningstorm`, `gargoyle`). O mapa de aliases (gerado do
 * `texts.csv`) faz a ponte; quando o nome já bate, `toKey` sozinho resolve.
 */
export function catalogKeyForApiName(name: string): string {
  const key = toKey(name);
  return GENERATED_API_ALIASES[key] ?? key;
}

/** Nível máximo do item liberado num dado Centro de Vila. 0 = não desbloqueado ainda. */
export function maxLevelForTownHall(entry: CatalogEntry, th: TownHallLevel): number {
  let max = 0;
  for (const spec of entry.levels) {
    if (spec.minTownHall <= th && spec.level > max) max = spec.level;
  }
  return max;
}

/** Custo acumulado do nível 1 até `level` (inclusive). */
export function cumulativeCost(entry: CatalogEntry, level: number): number {
  let total = 0;
  for (const spec of entry.levels) {
    if (spec.level <= level) total += spec.cost;
  }
  return total;
}

/** Tempo acumulado, em segundos, do nível 1 até `level` (inclusive). */
export function cumulativeBuildTime(entry: CatalogEntry, level: number): number {
  let total = 0;
  for (const spec of entry.levels) {
    if (spec.level <= level) total += spec.buildTimeSec;
  }
  return total;
}

/** Quantidade do item disponível num dado Centro de Vila. */
export function countAtTownHall(entry: CatalogEntry, th: TownHallLevel): number {
  if (entry.countByTownHall) {
    let count = 0;
    for (const [thLevel, qty] of Object.entries(entry.countByTownHall)) {
      const parsed = Number(thLevel);
      if (parsed <= th && qty > count) count = qty;
    }
    return count;
  }
  return maxLevelForTownHall(entry, th) > 0 ? 1 : 0;
}

/** Itens que existem (ao menos um nível liberado) num dado Centro de Vila. */
export function entriesForTownHall(catalog: Catalog, th: TownHallLevel): CatalogEntry[] {
  return catalog.filter((e) => e.village === "home" && maxLevelForTownHall(e, th) > 0);
}
