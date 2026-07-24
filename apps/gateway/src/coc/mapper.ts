import { classifyTroop, toKey } from "@clashpilot/coc-data";
import {
  type PlayerAchievement,
  type PlayerProfile,
  type PlayerTag,
  type PlayerUnit,
  parsePlayerTag,
} from "@clashpilot/core";
import type { PlayerDto } from "./dto.js";

/**
 * Anti-corruption layer: DTO da Supercell → domínio.
 *
 * Regras que importam aqui:
 *  - pets e cercos vêm dentro de `troops` e precisam ser reclassificados;
 *  - Super Tropas ativas são estado temporário, não progresso permanente;
 *  - equipamentos aparecem em dois lugares (dentro do herói e em `heroEquipment`) e são
 *    deduplicados por chave;
 *  - `maxLevel` é preservado como `globalMaxLevel` e marcado para não ser usado em progresso.
 */
interface UnitLike {
  readonly name: string;
  readonly level: number;
  readonly maxLevel: number;
  readonly village: "home" | "builderBase";
  readonly superTroopIsActive?: boolean | undefined;
}

function toUnit(dto: UnitLike, category: PlayerUnit["category"]): PlayerUnit {
  return {
    key: toKey(dto.name),
    name: dto.name,
    level: dto.level,
    category,
    village: dto.village,
    globalMaxLevel: dto.maxLevel,
    ...(dto.superTroopIsActive === true ? { superTroopActive: true } : {}),
  };
}

export function mapPlayer(dto: PlayerDto): PlayerProfile {
  const parsedTag = parsePlayerTag(dto.tag);
  // A API só devolve tags válidas; um erro aqui é bug nosso de normalização, não input do usuário.
  const tag: PlayerTag = parsedTag.ok ? parsedTag.value : (dto.tag as PlayerTag);

  const units: PlayerUnit[] = [];

  for (const troop of dto.troops) {
    units.push(toUnit(troop, classifyTroop(troop.name)));
  }
  for (const spell of dto.spells) {
    units.push(toUnit(spell, "spell"));
  }
  for (const hero of dto.heroes) {
    units.push(toUnit(hero, "hero"));
  }

  const seenEquipment = new Set<string>();
  const pushEquipment = (
    name: string,
    level: number,
    maxLevel: number,
    village: "home" | "builderBase",
  ): void => {
    const key = toKey(name);
    if (seenEquipment.has(key)) return;
    seenEquipment.add(key);
    units.push({ key, name, level, category: "equipment", village, globalMaxLevel: maxLevel });
  };

  for (const hero of dto.heroes) {
    for (const eq of hero.equipment ?? []) {
      pushEquipment(eq.name, eq.level, eq.maxLevel, eq.village ?? hero.village);
    }
  }
  for (const eq of dto.heroEquipment) {
    pushEquipment(eq.name, eq.level, eq.maxLevel, eq.village ?? "home");
  }

  const achievements: PlayerAchievement[] = dto.achievements.map((a) => ({
    name: a.name,
    stars: a.stars,
    value: a.value,
    target: a.target,
    village: a.village,
  }));

  return {
    tag,
    name: dto.name,
    townHallLevel: dto.townHallLevel,
    ...(dto.townHallWeaponLevel !== undefined
      ? { townHallWeaponLevel: dto.townHallWeaponLevel }
      : {}),
    expLevel: dto.expLevel,
    trophies: dto.trophies,
    bestTrophies: dto.bestTrophies,
    warStars: dto.warStars,
    attackWins: dto.attackWins,
    defenseWins: dto.defenseWins,
    donations: dto.donations,
    donationsReceived: dto.donationsReceived,
    clanCapitalContributions: dto.clanCapitalContributions,
    ...(dto.builderHallLevel !== undefined ? { builderHallLevel: dto.builderHallLevel } : {}),
    ...(dto.builderBaseTrophies !== undefined
      ? { builderBaseTrophies: dto.builderBaseTrophies }
      : {}),
    ...(dto.league
      ? {
          league: {
            id: dto.league.id,
            name: dto.league.name,
            ...(dto.league.iconUrls?.medium ? { iconUrl: dto.league.iconUrls.medium } : {}),
          },
        }
      : {}),
    ...(dto.clan
      ? {
          clan: {
            tag: dto.clan.tag,
            name: dto.clan.name,
            level: dto.clan.clanLevel,
            ...(dto.clan.badgeUrls?.medium ? { badgeUrl: dto.clan.badgeUrls.medium } : {}),
          },
        }
      : {}),
    units,
    achievements,
  };
}

/** Unidades que contam para progresso permanente da vila principal. */
export function progressUnits(profile: PlayerProfile): readonly PlayerUnit[] {
  return profile.units.filter((u) => u.village === "home" && u.superTroopActive !== true);
}
