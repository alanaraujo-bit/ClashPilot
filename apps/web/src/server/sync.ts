import "server-only";

import { CATALOG, SCORE_VERSION } from "@clashpilot/coc-data";
import type { PlayerProfileDto } from "@clashpilot/contracts";
import { API_KNOWN_CATEGORIES, computeMaxProgress, computeVillageScore } from "@clashpilot/core";
import { type Prisma, prisma } from "@clashpilot/db";

/**
 * Persistência de um perfil recém-lido.
 *
 * O cálculo é puro (`@clashpilot/core`) e a escrita é idempotente por dia: rodar duas vezes
 * no mesmo dia atualiza o snapshot, nunca duplica (`@@unique([playerId, capturedOn])`).
 * Ver docs/05-sync-e-cache.md §1.1.
 */

/** Meia-noite UTC do instante — chave de idempotência do snapshot diário. */
export function capturedOn(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function computeMetrics(profile: PlayerProfileDto, activeDays: number) {
  const progress = computeMaxProgress({
    catalog: CATALOG,
    townHallLevel: profile.townHallLevel,
    // Super Tropa ativa é estado temporário e Builder Base é outra vila: fora do progresso.
    knownCategories: API_KNOWN_CATEGORIES,
    units: profile.units
      .filter((u) => u.village === "home" && u.superTroopActive !== true)
      .map((u) =>
        u.count === undefined
          ? { key: u.key, level: u.level }
          : { key: u.key, level: u.level, count: u.count },
      ),
  });

  const score = computeVillageScore({
    progress,
    // Sem histórico ainda: o fator de aderência é omitido em vez de inventado (ADR-008).
    priorityAdherence: null,
    activeDays,
    windowDays: 14,
  });

  const heroSumLevel = profile.units
    .filter((u) => u.category === "hero" && u.village === "home")
    .reduce((acc, u) => acc + u.level, 0);

  return { progress, score, heroSumLevel };
}

export async function persistProfile(
  playerId: string,
  profile: PlayerProfileDto,
  now = new Date(),
) {
  const { progress, score, heroSumLevel } = computeMetrics(profile, 1);

  const units = profile.units as unknown as Prisma.InputJsonValue;
  const achievements = profile.achievements as unknown as Prisma.InputJsonValue;
  // O breakdown guarda também a COBERTURA: sem ela, um "2,9%" no histórico ficaria
  // indistinguível de uma vila realmente parada em 2,9%.
  const breakdown = {
    factors: score.factors,
    coverageBp: progress.coverageBp,
    unknownCategories: progress.unknownCategories,
    byCategory: progress.byCategory,
  } as unknown as Prisma.InputJsonValue;

  const common = {
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

  await prisma.$transaction([
    prisma.playerCurrent.upsert({
      where: { playerId },
      create: {
        playerId,
        ...common,
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
        ...common,
        townHallWeapon: profile.townHallWeaponLevel ?? null,
        leagueName: profile.league?.name ?? null,
        clanName: profile.clan?.name ?? null,
        capitalContributions: Math.round(profile.clanCapitalContributions),
        units,
        achievements,
        scoreBreakdown: breakdown,
        computedAt: now,
      },
    }),
    prisma.playerSnapshot.upsert({
      where: { playerId_capturedOn: { playerId, capturedOn: capturedOn(now) } },
      create: {
        playerId,
        capturedOn: capturedOn(now),
        capturedAt: now,
        units,
        heroSumLevel,
        ...common,
      },
      update: { capturedAt: now, units, heroSumLevel, revision: { increment: 1 }, ...common },
    }),
    prisma.player.update({
      where: { id: playerId },
      data: { name: profile.name, lastSyncAt: now, lastSyncStatus: "OK" },
    }),
  ]);

  return { progress, score };
}
