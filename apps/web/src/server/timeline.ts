import "server-only";

import { prisma } from "@clashpilot/db";

/**
 * Leitura da timeline. Os gráficos vêm de `PlayerSnapshot` (colunas já agregadas, zero window
 * function) e a lista de eventos de `ProgressEvent` — a redundância deliberada do ADR-005.
 */

export interface SnapshotPoint {
  readonly on: string;
  readonly trophies: number;
  readonly maxProgressBp: number | null;
  readonly villageScore: number | null;
  readonly heroSumLevel: number | null;
}

export async function loadSnapshots(playerId: string, days = 90): Promise<SnapshotPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.playerSnapshot.findMany({
    where: { playerId, capturedAt: { gte: since } },
    orderBy: { capturedOn: "asc" },
    select: {
      capturedOn: true,
      trophies: true,
      maxProgressBp: true,
      villageScore: true,
      heroSumLevel: true,
    },
  });

  return rows.map((row) => ({
    on: row.capturedOn.toISOString().slice(0, 10),
    trophies: row.trophies,
    maxProgressBp: row.maxProgressBp,
    villageScore: row.villageScore,
    heroSumLevel: row.heroSumLevel,
  }));
}

export interface TimelineEvent {
  readonly id: string;
  readonly at: string;
  readonly type: string;
  readonly key: string | null;
  readonly fromLevel: number | null;
  readonly toLevel: number | null;
  readonly delta: number | null;
  readonly meta: Record<string, unknown> | null;
}

/** Paginação por cursor (`at`,`id`) — nunca OFFSET (docs/02 §5). */
export async function loadEvents(
  playerId: string,
  limit = 50,
  cursor?: { at: Date; id: string },
): Promise<{ events: TimelineEvent[]; nextCursor: { at: string; id: string } | null }> {
  const rows = await prisma.progressEvent.findMany({
    where: { playerId },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    select: {
      id: true,
      at: true,
      type: true,
      key: true,
      fromLevel: true,
      toLevel: true,
      delta: true,
      meta: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return {
    events: page.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      type: row.type,
      key: row.key,
      fromLevel: row.fromLevel,
      toLevel: row.toLevel,
      delta: row.delta,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
    })),
    nextCursor: hasMore && last ? { at: last.at.toISOString(), id: last.id } : null,
  };
}
