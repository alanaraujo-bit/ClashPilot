"use server";

import { CATALOG, findEntry } from "@clashpilot/coc-data";
import { prisma } from "@clashpilot/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recomputeProgress } from "../ledger";
import { requirePlayerAccess } from "../session";

/**
 * Salvamento do Village Ledger.
 *
 * Salva uma CATEGORIA inteira por vez. Isso não é detalhe de UI: é o que permite tratar
 * "declarado como nível 0" (não construído) de forma diferente de "não declarado"
 * (não sabemos) — a distinção que sustenta o ADR-015.
 */

export type LedgerActionState =
  | { readonly status: "idle" }
  | { readonly status: "saved"; readonly category: string }
  | { readonly status: "error"; readonly message: string };

const payloadSchema = z.object({
  playerId: z.string().min(1),
  category: z.enum(["defense", "wall", "trap", "infrastructure"]),
  entries: z
    .array(
      z.object({
        key: z.string().min(1),
        slot: z.number().int().min(0),
        level: z.number().int().min(0),
        count: z.number().int().min(0).default(1),
      }),
    )
    .max(2_000),
});

export async function saveLedgerAction(
  _prev: LedgerActionState,
  formData: FormData,
): Promise<LedgerActionState> {
  const raw = formData.get("payload");
  const parsed = payloadSchema.safeParse(
    typeof raw === "string" ? (JSON.parse(raw) as unknown) : null,
  );
  if (!parsed.success) return { status: "error", message: "Dados do formulário inválidos." };

  const { playerId, category, entries } = parsed.data;
  const player = await requirePlayerAccess(playerId);

  // Modo observação não declara nada: o registro da vila é dado pessoal de conta verificada.
  if (!player.verified) {
    return {
      status: "error",
      message:
        "Só é possível preencher o registro de uma vila verificada. Vincule a conta com o token do jogo.",
    };
  }

  const current = await prisma.playerCurrent.findUnique({
    where: { playerId },
    select: { townHallLevel: true },
  });
  if (!current)
    return { status: "error", message: "Ainda não lemos sua vila. Tente em instantes." };

  // Validação contra o catálogo: nível acima do teto do TH, ou item de outra categoria,
  // é dado corrompido — recusar é melhor do que gravar e envenenar o progresso.
  for (const item of entries) {
    const entry = findEntry(CATALOG, item.key);
    if (!entry || entry.scoreCategory !== category) {
      return { status: "error", message: `Item desconhecido nesta categoria: ${item.key}` };
    }
    const maxLevel = entry.levels.reduce(
      (max, level) =>
        level.minTownHall <= current.townHallLevel && level.level > max ? level.level : max,
      0,
    );
    if (item.level > maxLevel) {
      return {
        status: "error",
        message: `${entry.name} não passa do nível ${maxLevel} no Centro de Vila ${current.townHallLevel}.`,
      };
    }
  }

  const keys = [...new Set(entries.map((e) => e.key))];

  await prisma.$transaction([
    // Substitui a categoria inteira: um prédio removido do formulário some do ledger.
    prisma.villageBuilding.deleteMany({ where: { playerId, buildingKey: { in: keys } } }),
    prisma.villageBuilding.createMany({
      data: entries.map((item) => ({
        playerId,
        buildingKey: item.key,
        slot: item.slot,
        level: item.level,
        count: item.count,
        source: "MANUAL" as const,
      })),
    }),
  ]);

  await recomputeProgress(playerId);

  revalidatePath("/dashboard");
  revalidatePath("/vila");
  return { status: "saved", category };
}
