import type { TownHallSpec, TownHallLevel } from "./types.js";

/**
 * Tabela de Centros de Vila.
 *
 * `labLevel` segue a regra estável do jogo: o Laboratório abre no TH3 e seu nível máximo é
 * `th - 2`. Essa relação é determinística e está coberta por teste.
 *
 * `wallCount` e `wallMaxLevel` estão marcados com `verified: false` até a Fase 3, quando o
 * catálogo completo (custo e tempo de cada nível) entra a partir de fonte curada. Enquanto
 * `verified` for `false`, a UI exibe os números derivados como estimativa — nunca como fato.
 * Ver ADR-004 e docs/09-roadmap.md (Fase 3).
 */
export const TOWN_HALLS: readonly TownHallSpec[] = [
  { level: 1, labLevel: null, wallCount: 0, wallMaxLevel: 0, verified: false },
  { level: 2, labLevel: null, wallCount: 25, wallMaxLevel: 2, verified: false },
  { level: 3, labLevel: 1, wallCount: 50, wallMaxLevel: 3, verified: false },
  { level: 4, labLevel: 2, wallCount: 75, wallMaxLevel: 4, verified: false },
  { level: 5, labLevel: 3, wallCount: 100, wallMaxLevel: 5, verified: false },
  { level: 6, labLevel: 4, wallCount: 125, wallMaxLevel: 6, verified: false },
  { level: 7, labLevel: 5, wallCount: 175, wallMaxLevel: 7, verified: false },
  { level: 8, labLevel: 6, wallCount: 225, wallMaxLevel: 8, verified: false },
  { level: 9, labLevel: 7, wallCount: 250, wallMaxLevel: 9, verified: false },
  { level: 10, labLevel: 8, wallCount: 275, wallMaxLevel: 11, verified: false },
  { level: 11, labLevel: 9, wallCount: 300, wallMaxLevel: 12, verified: false },
  { level: 12, labLevel: 10, wallCount: 300, wallMaxLevel: 13, verified: false },
  { level: 13, labLevel: 11, wallCount: 300, wallMaxLevel: 14, verified: false },
  { level: 14, labLevel: 12, wallCount: 325, wallMaxLevel: 15, verified: false },
  { level: 15, labLevel: 13, wallCount: 325, wallMaxLevel: 16, verified: false },
  { level: 16, labLevel: 14, wallCount: 325, wallMaxLevel: 17, verified: false },
  { level: 17, labLevel: 15, wallCount: 325, wallMaxLevel: 18, verified: false },
] as const;

export const MIN_TOWN_HALL: TownHallLevel = 1;
export const MAX_TOWN_HALL: TownHallLevel = 17;

export function townHall(level: TownHallLevel): TownHallSpec | undefined {
  return TOWN_HALLS.find((th) => th.level === level);
}

export function isValidTownHall(level: number): boolean {
  return Number.isInteger(level) && level >= MIN_TOWN_HALL && level <= MAX_TOWN_HALL;
}
