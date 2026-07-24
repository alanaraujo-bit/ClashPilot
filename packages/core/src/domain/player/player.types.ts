import type { AchievementScope, UnitCategory, UnitState, Village } from "@clashpilot/coc-data";
import type { PlayerTag } from "./player-tag.js";

/**
 * Tipos de domínio do jogador — já normalizados. Nenhum DTO da Supercell chega até aqui:
 * o mapeamento acontece na borda (anti-corruption layer), em `apps/gateway`.
 */

export interface PlayerUnit extends UnitState {
  readonly name: string;
  readonly category: UnitCategory;
  readonly village: Village;
  /** Máximo GLOBAL do jogo, como vem da API. NÃO usar para calcular progresso — ver ADR-006. */
  readonly globalMaxLevel: number;
  readonly superTroopActive?: boolean;
}

export interface PlayerAchievement {
  readonly name: string;
  readonly stars: number;
  readonly value: number;
  readonly target: number;
  readonly scope: AchievementScope;
}

export interface PlayerLeague {
  readonly id: number;
  readonly name: string;
  readonly iconUrl?: string;
}

export interface PlayerClanRef {
  readonly tag: string;
  readonly name: string;
  readonly level: number;
  readonly badgeUrl?: string;
}

export interface PlayerProfile {
  readonly tag: PlayerTag;
  readonly name: string;
  readonly townHallLevel: number;
  readonly townHallWeaponLevel?: number;
  readonly expLevel: number;
  readonly trophies: number;
  readonly bestTrophies: number;
  readonly warStars: number;
  readonly attackWins: number;
  readonly defenseWins: number;
  readonly donations: number;
  readonly donationsReceived: number;
  readonly clanCapitalContributions: number;
  readonly builderHallLevel?: number;
  readonly builderBaseTrophies?: number;
  readonly league?: PlayerLeague;
  readonly clan?: PlayerClanRef;
  readonly units: readonly PlayerUnit[];
  readonly achievements: readonly PlayerAchievement[];
}

/**
 * Achievements que revelam o nível EXATO de uma construção — descoberto no estudo da API
 * (docs/api/oportunidades-produto.md). São dados verificados: o Village Ledger não precisa
 * perguntar por eles.
 */
export const BUILDING_LEVEL_ACHIEVEMENTS: Readonly<Record<string, string>> = {
  "Empire Builder": "clanCastle",
  "Bigger Coffers": "goldStorage",
  "Master Engineering": "builderHall",
};

export function inferBuildingLevels(
  achievements: readonly PlayerAchievement[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const achievement of achievements) {
    const key = BUILDING_LEVEL_ACHIEVEMENTS[achievement.name];
    if (key !== undefined) out[key] = achievement.value;
  }
  return out;
}
