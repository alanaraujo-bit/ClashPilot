import type { PlayerProfile, PlayerUnit } from "../player/player.types.js";

/**
 * Motor de diff: dois perfis → a lista de eventos que aconteceram entre eles.
 *
 * É função pura. Isso é o que permite reprocessar um ano de histórico offline se a regra
 * mudar, e é o que torna o snapshot diário auditável (docs/05-sync-e-cache.md §1.1).
 *
 * O tipo de evento aqui é de DOMÍNIO — não é o enum do Prisma. A infraestrutura mapeia.
 */

export type DomainEventType =
  | "th_up"
  | "hero_level_up"
  | "troop_level_up"
  | "spell_level_up"
  | "pet_level_up"
  | "equipment_level_up"
  | "league_change"
  | "trophy_peak"
  | "clan_change";

export interface DomainEvent {
  readonly type: DomainEventType;
  readonly key?: string;
  readonly name?: string;
  readonly fromLevel?: number;
  readonly toLevel?: number;
  readonly delta?: number;
  readonly meta?: Readonly<Record<string, string | number>>;
}

const CATEGORY_EVENT: Partial<Record<PlayerUnit["category"], DomainEventType>> = {
  hero: "hero_level_up",
  troop: "troop_level_up",
  spell: "spell_level_up",
  pet: "pet_level_up",
  equipment: "equipment_level_up",
  siege: "troop_level_up",
};

/** Maior nível por chave na vila principal — ignora Builder Base e Super Tropa ativa. */
function levelByKey(profile: PlayerProfile): Map<string, PlayerUnit> {
  const map = new Map<string, PlayerUnit>();
  for (const unit of profile.units) {
    if (unit.village !== "home" || unit.superTroopActive === true) continue;
    const existing = map.get(unit.key);
    if (!existing || unit.level > existing.level) map.set(unit.key, unit);
  }
  return map;
}

export function diffProfiles(previous: PlayerProfile, next: PlayerProfile): DomainEvent[] {
  const events: DomainEvent[] = [];

  if (next.townHallLevel > previous.townHallLevel) {
    events.push({
      type: "th_up",
      fromLevel: previous.townHallLevel,
      toLevel: next.townHallLevel,
    });
  }

  const before = levelByKey(previous);
  for (const [key, unit] of levelByKey(next)) {
    const old = before.get(key);
    const fromLevel = old?.level ?? 0;
    if (unit.level <= fromLevel) continue;

    const type = CATEGORY_EVENT[unit.category];
    if (!type) continue;
    events.push({ type, key, name: unit.name, fromLevel, toLevel: unit.level });
  }

  if (previous.league?.id !== next.league?.id && next.league) {
    events.push({
      type: "league_change",
      name: next.league.name,
      meta: {
        from: previous.league?.name ?? "sem liga",
        to: next.league.name,
      },
    });
  }

  // Pico de troféus: só quando o recorde PESSOAL sobe, não a cada oscilação de temporada.
  if (next.bestTrophies > previous.bestTrophies) {
    events.push({
      type: "trophy_peak",
      delta: next.bestTrophies - previous.bestTrophies,
      toLevel: next.bestTrophies,
    });
  }

  if (previous.clan?.tag !== next.clan?.tag) {
    events.push({
      type: "clan_change",
      meta: {
        from: previous.clan?.name ?? "sem clã",
        to: next.clan?.name ?? "sem clã",
      },
    });
  }

  return events;
}

/**
 * Séries cumulativas dos achievements — a única fonte vitalícia da API (docs/01 §3).
 * `Gold Grab` = ouro saqueado na vida toda; a diferença entre snapshots dá a taxa de farm.
 */
const ACHIEVEMENT_METRICS: Record<string, string> = {
  "Gold Grab": "goldLootTotal",
  "Elixir Escapade": "elixirLootTotal",
  "Heroic Heist": "darkLootTotal",
};

export function extractLootTotals(profile: PlayerProfile): Record<string, number> {
  const out: Record<string, number> = {};
  for (const achievement of profile.achievements) {
    const metric = ACHIEVEMENT_METRICS[achievement.name];
    if (metric) out[metric] = achievement.value;
  }
  return out;
}
