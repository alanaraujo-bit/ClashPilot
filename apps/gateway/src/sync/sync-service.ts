import { parsePlayerTag } from "@clashpilot/core";
import { prisma } from "@clashpilot/db";
import type { FastifyBaseLogger } from "fastify";
import type { CocApiClient } from "../coc/client.js";
import { persistSync } from "./persist.js";

/**
 * Worker de sincronização.
 *
 * É o único escritor do histórico e mora no gateway porque precisa de processo longo e cron
 * confiável — coisas que uma serverless function faz mal (ADR-001). Ele respeita o rate limit
 * do próprio cliente da API, então sincronizar 500 jogadores não estoura a cota da Supercell.
 */

export interface SyncStats {
  readonly attempted: number;
  readonly ok: number;
  readonly failed: number;
  readonly events: number;
}

async function syncOne(
  coc: CocApiClient,
  log: FastifyBaseLogger,
  player: { id: string; tag: string },
): Promise<{ ok: boolean; events: number }> {
  const tag = parsePlayerTag(player.tag);
  if (!tag.ok) {
    await prisma.player.update({ where: { id: player.id }, data: { lastSyncStatus: "ERROR" } });
    return { ok: false, events: 0 };
  }

  const result = await coc.getPlayer(tag.value);
  if (!result.ok) {
    // notFound é permanente; o resto é transitório. Ambos param este jogador nesta rodada.
    const status = result.error.kind === "notFound" ? "NOT_FOUND" : "ERROR";
    await prisma.player.update({ where: { id: player.id }, data: { lastSyncStatus: status } });
    log.warn({ tag: player.tag, error: result.error.kind }, "falha ao sincronizar jogador");
    return { ok: false, events: 0 };
  }

  const outcome = await persistSync(player.id, result.value, result.value);
  return { ok: true, events: outcome.events };
}

/** Sincroniza todos os jogadores habilitados, do mais prioritário ao menos. */
export async function syncAllPlayers(
  coc: CocApiClient,
  log: FastifyBaseLogger,
  limit = 500,
): Promise<SyncStats> {
  const players = await prisma.player.findMany({
    where: { syncEnabled: true },
    orderBy: [{ syncPriority: "desc" }, { lastSyncAt: "asc" }],
    take: limit,
    select: { id: true, tag: true },
  });

  const stats = { attempted: players.length, ok: 0, failed: 0, events: 0 };
  for (const player of players) {
    try {
      const { ok, events } = await syncOne(coc, log, player);
      if (ok) {
        stats.ok += 1;
        stats.events += events;
      } else {
        stats.failed += 1;
      }
    } catch (error) {
      stats.failed += 1;
      log.error({ tag: player.tag, error }, "erro inesperado no sync");
    }
  }

  log.info(stats, "rodada de sincronização concluída");
  return stats;
}

/** Sync sob demanda de um jogador (botão de atualizar), com throttle de 60 s. */
export async function syncSinglePlayer(
  coc: CocApiClient,
  log: FastifyBaseLogger,
  playerId: string,
): Promise<{ ok: boolean; throttled?: boolean; events?: number }> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, tag: true, lastSyncAt: true },
  });
  if (!player) return { ok: false };

  const since = player.lastSyncAt ? Date.now() - player.lastSyncAt.getTime() : Infinity;
  if (since < 60_000) return { ok: false, throttled: true };

  const { ok, events } = await syncOne(coc, log, player);
  return { ok, events };
}
