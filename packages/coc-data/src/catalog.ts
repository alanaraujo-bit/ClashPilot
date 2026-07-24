import type { CatalogEntry, TownHallLevel } from "./types.js";

/**
 * Registro do catálogo.
 *
 * ⚠️ ESTADO: vazio de propósito na Fase 0.
 *
 * Preencher com custo/tempo reais de cada nível é a **Fase 3** do roadmap e a maior tarefa de
 * dados do projeto (docs/09-roadmap.md). Nada aqui pode ser "chutado": um número errado
 * corrompe o MAX% e o ROI de todos os usuários de forma silenciosa.
 *
 * Toda a matemática que consome este catálogo já está implementada e testada em
 * `@clashpilot/core` — ela recebe o catálogo por parâmetro, então o motor fica pronto antes
 * dos dados e passa a produzir números reais assim que o catálogo for preenchido.
 */
export const CATALOG: readonly CatalogEntry[] = [];

export type Catalog = readonly CatalogEntry[];

export function findEntry(catalog: Catalog, key: string): CatalogEntry | undefined {
  return catalog.find((e) => e.key === key);
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
