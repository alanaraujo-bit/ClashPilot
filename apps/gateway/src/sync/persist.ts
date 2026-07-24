import { gzipSync } from "node:zlib";
import { CATALOG, SCORE_VERSION, type ScoreCategory } from "@clashpilot/coc-data";
import {
  API_KNOWN_CATEGORIES,
  type DomainEvent,
  LEDGER_CATEGORIES,
  type PlayerProfile,
  computeMaxProgress,
  computeVillageScore,
  diffProfiles,
  extractLootTotals,
  knownCategoriesFrom,
  ledgerToUnits,
} from "@clashpilot/core";
import { type Prisma, prisma } from "@clashpilot/db";
import { $Enums } from "@clashpilot/db";

/**
 * Persistência de um sync: estado atual + snapshot diário idempotente + eventos do diff.
 *
 * Todo o cálculo é puro (`@clashpilot/core`); aqui só há I/O. O snapshot é único por dia
 * (`@@unique([playerId, capturedOn])`), então rodar o worker duas vezes no mesmo dia atualiza,
 * nunca duplica — docs/05-sync-e-cache.md §1.1.
 */

const EVENT_TYPE: Record<DomainEvent["type"], $Enums.EventType> = {
  th_up: $Enums.EventType.TH_UP,
  hero_level_up: $Enums.EventType.HERO_LEVEL_UP,
  troop_level_up: $Enums.EventType.TROOP_LEVEL_UP,
  spell_level_up: $Enums.EventType.SPELL_LEVEL_UP,
  pet_level_up: $Enums.EventType.PET_LEVEL_UP,
  equipment_level_up: $Enums.EventType.EQUIPMENT_LEVEL_UP,
  league_change: $Enums.EventType.LEAGUE_CHANGE,
  trophy_peak: $Enums.EventType.TROPHY_PEAK,
  clan_change: $Enums.EventType.CLAN_CHANGE,
};

/** Meia-noite UTC — a chave de idempotência do snapshot diário. */
function capturedOn(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Reconstrói um perfil-suficiente-para-diff a partir do último `PlayerCurrent`. */
function profileFromCurrent(current: {
  townHallLevel: number;
  trophies: number;
  bestTrophies: number;
  leagueId: number | null;
  leagueName: string | null;
  clanTag: string | null;
  clanName: string | null;
  units: Prisma.JsonValue;
}): PlayerProfile | null {
  if (!Array.isArray(current.units)) return null;
  return {
    tag: "#PREV" as PlayerProfile["tag"],
    name: "",
    townHallLevel: current.townHallLevel,
    expLevel: 0,
    trophies: current.trophies,
    bestTrophies: current.bestTrophies,
    warStars: 0,
    attackWins: 0,
    defenseWins: 0,
    donations: 0,
    donationsReceived: 0,
    clanCapitalContributions: 0,
    ...(current.leagueId
      ? { league: { id: current.leagueId, name: current.leagueName ?? "" } }
      : {}),
    ...(current.clanTag
      ? { clan: { tag: current.clanTag, name: current.clanName ?? "", level: 0 } }
      : {}),
    units: current.units as unknown as PlayerProfile["units"],
    achievements: [],
  };
}

const categoryByKey = new Map(CATALOG.map((entry) => [entry.key, entry.scoreCategory]));

export interface SyncOutcome {
  readonly events: number;
  readonly maxProgressBp: number | null;
  readonly villageScore: number | null;
}

export async function persistSync(
  playerId: string,
  profile: PlayerProfile,
  rawPayload: unknown,
  now = new Date(),
): Promise<SyncOutcome> {
  const previous = await prisma.playerCurrent.findUnique({ where: { playerId } });
  const ledger = await prisma.villageBuilding.findMany({
    where: { playerId },
    select: { buildingKey: true, slot: true, level: true, count: true },
  });

  const declared = new Set<ScoreCategory>();
  for (const row of ledger) {
    const category = categoryByKey.get(row.buildingKey);
    if (category && LEDGER_CATEGORIES.has(category)) declared.add(category);
  }

  const homeUnits = profile.units
    .filter((u) => u.village === "home" && u.superTroopActive !== true)
    .map((u) => ({ key: u.key, level: u.level }));

  const progress = computeMaxProgress({
    catalog: CATALOG,
    townHallLevel: profile.townHallLevel,
    units: [...homeUnits, ...ledgerToUnits(ledger)],
    knownCategories: knownCategoriesFrom(API_KNOWN_CATEGORIES, [...declared]),
  });
  const score = computeVillageScore({
    progress,
    priorityAdherence: null,
    activeDays: 7,
    windowDays: 14,
  });

  const events = previous ? diffProfiles(profileFromCurrent(previous) ?? profile, profile) : [];

  const loot = extractLootTotals(profile);
  const units = profile.units as unknown as Prisma.InputJsonValue;
  const achievements = profile.achievements as unknown as Prisma.InputJsonValue;
  const breakdown = {
    factors: score.factors,
    coverageBp: progress.coverageBp,
    unknownCategories: progress.unknownCategories,
    byCategory: progress.byCategory,
  } as unknown as Prisma.InputJsonValue;

  const heroSumLevel = profile.units
    .filter((u) => u.category === "hero" && u.village === "home")
    .reduce((acc, u) => acc + u.level, 0);

  const scalar = {
    townHallLevel: profile.townHallLevel,
    expLevel: profile.expLevel,
    trophies: profile.trophies,
    bestTrophies: profile.bestTrophies,
    leagueId: profile.league?.id ?? null,
    warStars: profile.warStars,
    attackWins: profile.attackWins,
    defenseWins: profile.defenseWins,
    donations: profile.donations,
    donationsReceived: profile.donationsReceived,
    clanTag: profile.clan?.tag ?? null,
    builderHallLevel: profile.builderHallLevel ?? null,
    builderTrophies: profile.builderBaseTrophies ?? null,
    villageScore: score.reliable ? score.score : null,
    maxProgressBp: progress.reliable ? progress.totalBp : null,
    scoreVersion: SCORE_VERSION,
  };

  await prisma.$transaction(async (tx) => {
    await tx.playerCurrent.upsert({
      where: { playerId },
      create: {
        playerId,
        ...scalar,
        townHallWeapon: profile.townHallWeaponLevel ?? null,
        leagueName: profile.league?.name ?? null,
        clanName: profile.clan?.name ?? null,
        capitalContributions: Math.round(profile.clanCapitalContributions),
        units,
        achievements,
        scoreBreakdown: breakdown,
        computedAt: now,
      },
      update: {
        ...scalar,
        townHallWeapon: profile.townHallWeaponLevel ?? null,
        leagueName: profile.league?.name ?? null,
        clanName: profile.clan?.name ?? null,
        capitalContributions: Math.round(profile.clanCapitalContributions),
        units,
        achievements,
        scoreBreakdown: breakdown,
        computedAt: now,
      },
    });

    const snapshot = await tx.playerSnapshot.upsert({
      where: { playerId_capturedOn: { playerId, capturedOn: capturedOn(now) } },
      create: {
        playerId,
        capturedOn: capturedOn(now),
        capturedAt: now,
        units,
        heroSumLevel,
        goldLootTotal: loot["goldLootTotal"] ?? null,
        elixirLootTotal: loot["elixirLootTotal"] ?? null,
        darkLootTotal: loot["darkLootTotal"] ?? null,
        ...scalar,
      },
      update: {
        capturedAt: now,
        units,
        heroSumLevel,
        revision: { increment: 1 },
        goldLootTotal: loot["goldLootTotal"] ?? null,
        elixirLootTotal: loot["elixirLootTotal"] ?? null,
        darkLootTotal: loot["darkLootTotal"] ?? null,
        ...scalar,
      },
    });

    // Payload bruto arquivado (gzip) para reprocessamento futuro — só na criação do snapshot.
    await tx.playerSnapshotRaw.upsert({
      where: { snapshotId: snapshot.id },
      create: { snapshotId: snapshot.id, payload: gzipSync(JSON.stringify(rawPayload)) },
      update: {},
    });

    if (events.length > 0) {
      await tx.progressEvent.createMany({
        data: events.map((event): Prisma.ProgressEventCreateManyInput => ({
          playerId,
          at: now,
          type: EVENT_TYPE[event.type],
          key: event.key ?? null,
          fromLevel: event.fromLevel ?? null,
          toLevel: event.toLevel ?? null,
          delta: event.delta ?? null,
          ...(event.meta ? { meta: event.meta as Prisma.InputJsonValue } : {}),
        })),
      });
    }

    await tx.player.update({
      where: { id: playerId },
      data: { name: profile.name, lastSyncAt: now, lastSyncStatus: "OK" },
    });
  });

  return {
    events: events.length,
    maxProgressBp: scalar.maxProgressBp,
    villageScore: scalar.villageScore,
  };
}
