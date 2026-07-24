import "server-only";

import { CATALOG, type ScoreCategory } from "@clashpilot/coc-data";
import { unitSchema } from "@clashpilot/contracts";
import {
  API_KNOWN_CATEGORIES,
  type LedgerRow,
  LEDGER_CATEGORIES,
  computeMaxProgress,
  computeVillageScore,
  knownCategoriesFrom,
  ledgerSlotsForTownHall,
  ledgerToUnits,
} from "@clashpilot/core";
import { type Prisma, prisma } from "@clashpilot/db";
import { z } from "zod";
import { SCORE_VERSION } from "@clashpilot/coc-data";

const unitsSchema = z.array(unitSchema).catch([]);

/** Mapa chave→categoria, para saber quais categorias o jogador já declarou. */
const categoryByKey = new Map(CATALOG.map((entry) => [entry.key, entry.scoreCategory]));

export async function loadLedger(playerId: string): Promise<LedgerRow[]> {
  const rows = await prisma.villageBuilding.findMany({
    where: { playerId },
    select: { buildingKey: true, slot: true, level: true, count: true },
  });
  return rows;
}

export function declaredCategories(rows: readonly LedgerRow[]): ScoreCategory[] {
  const declared = new Set<ScoreCategory>();
  for (const row of rows) {
    const category = categoryByKey.get(row.buildingKey);
    if (category && LEDGER_CATEGORIES.has(category)) declared.add(category);
  }
  return [...declared];
}

/**
 * Recalcula progresso e score a partir do estado atual: unidades da API (já persistidas em
 * `PlayerCurrent`) somadas ao que o jogador declarou no ledger.
 *
 * Existe separado do sync porque salvar o ledger não deve gastar uma chamada à API — o dado
 * da Supercell não mudou, só o que nós sabemos sobre a vila.
 */
export async function recomputeProgress(playerId: string): Promise<void> {
  const current = await prisma.playerCurrent.findUnique({ where: { playerId } });
  if (!current) return;

  const apiUnits = unitsSchema
    .parse(current.units)
    .filter((unit) => unit.village === "home" && unit.superTroopActive !== true);
  const ledger = await loadLedger(playerId);

  const units = [
    ...apiUnits.map((u) =>
      u.count === undefined
        ? { key: u.key, level: u.level }
        : { key: u.key, level: u.level, count: u.count },
    ),
    ...ledgerToUnits(ledger),
  ];

  const progress = computeMaxProgress({
    catalog: CATALOG,
    townHallLevel: current.townHallLevel,
    units,
    knownCategories: knownCategoriesFrom(API_KNOWN_CATEGORIES, declaredCategories(ledger)),
  });

  const score = computeVillageScore({
    progress,
    priorityAdherence: null,
    activeDays: 7,
    windowDays: 14,
  });

  await prisma.playerCurrent.update({
    where: { playerId },
    data: {
      maxProgressBp: progress.reliable ? progress.totalBp : null,
      villageScore: score.reliable ? score.score : null,
      scoreVersion: SCORE_VERSION,
      scoreBreakdown: {
        factors: score.factors,
        coverageBp: progress.coverageBp,
        unknownCategories: progress.unknownCategories,
        byCategory: progress.byCategory,
      } as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
    },
  });
}

/** Formulário do ledger: o que declarar, com o que já foi declarado preenchido. */
export async function buildLedgerView(playerId: string, townHallLevel: number) {
  const rows = await loadLedger(playerId);
  const byKey = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const list = byKey.get(row.buildingKey) ?? [];
    list.push(row);
    byKey.set(row.buildingKey, list);
  }

  return ledgerSlotsForTownHall(CATALOG, townHallLevel).map((slot) => ({
    ...slot,
    declared: (byKey.get(slot.key) ?? []).sort((a, b) => a.slot - b.slot),
  }));
}
