import { GENERATED_TOWN_HALLS } from "./generated/catalog.js";
import type { TownHallLevel, TownHallSpec } from "./types.js";

/**
 * Tabela de Centros de Vila, derivada dos arquivos de lógica do jogo:
 *  - `labLevel`   = maior nível de Laboratório liberado naquele TH;
 *  - `wallCount`  = quantidade de muralhas permitida (coluna do `townhall_levels.csv`);
 *  - `wallMaxLevel` = maior nível de muralha liberado.
 *
 * Nada aqui é digitado à mão — a tabela da Fase 0 vinha de memória e estava marcada como
 * `verified: false` justamente por isso.
 */
export const TOWN_HALLS: readonly TownHallSpec[] = GENERATED_TOWN_HALLS;

export const MIN_TOWN_HALL: TownHallLevel = 1;
export const MAX_TOWN_HALL: TownHallLevel = TOWN_HALLS.length;

export function townHall(level: TownHallLevel): TownHallSpec | undefined {
  return TOWN_HALLS.find((th) => th.level === level);
}

export function isValidTownHall(level: number): boolean {
  return Number.isInteger(level) && level >= MIN_TOWN_HALL && level <= MAX_TOWN_HALL;
}
