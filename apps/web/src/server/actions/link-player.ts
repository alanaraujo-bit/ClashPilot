"use server";

import { parsePlayerTag, describeTagError } from "@clashpilot/core";
import { prisma } from "@clashpilot/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { describeGatewayError, getPlayer, verifyPlayerToken } from "../gateway-client";
import { requireUser } from "../session";
import { persistProfile } from "../sync";

/**
 * Vinculação de conta de jogo (docs/04-auth.md §3).
 *
 * Dois modos: VERIFICADA (prova de posse via token do jogo) e OBSERVAÇÃO (só leitura).
 * A distinção não é decorativa — o Village Ledger, metas e notificações só existem para
 * contas verificadas, para o app não virar ferramenta de vigilância de terceiros.
 */

export type PlayerPreview = {
  readonly tag: string;
  readonly name: string;
  readonly townHallLevel: number;
  readonly trophies: number;
  readonly leagueName: string | null;
  readonly clanName: string | null;
};

export type ActionState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "preview"; readonly player: PlayerPreview };

const tagInput = z.object({ tag: z.string().min(1, "Digite a tag da sua vila.") });

export async function searchPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const input = tagInput.safeParse({ tag: formData.get("tag") });
  if (!input.success) {
    return { status: "error", message: input.error.issues[0]?.message ?? "Tag inválida." };
  }

  const tag = parsePlayerTag(input.data.tag);
  if (!tag.ok) return { status: "error", message: describeTagError(tag.error) };

  const result = await getPlayer(tag.value);
  if (!result.ok) return { status: "error", message: describeGatewayError(result.error) };

  const p = result.value;
  return {
    status: "preview",
    player: {
      tag: p.tag,
      name: p.name,
      townHallLevel: p.townHallLevel,
      trophies: p.trophies,
      leagueName: p.league?.name ?? null,
      clanName: p.clan?.name ?? null,
    },
  };
}

const linkInput = z.object({
  tag: z.string().min(1),
  mode: z.enum(["verified", "observed"]),
  token: z.string().optional(),
});

export async function linkPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const input = linkInput.safeParse({
    tag: formData.get("tag"),
    mode: formData.get("mode"),
    token: formData.get("token")?.toString().trim() || undefined,
  });
  if (!input.success) return { status: "error", message: "Dados incompletos." };

  const tag = parsePlayerTag(input.data.tag);
  if (!tag.ok) return { status: "error", message: describeTagError(tag.error) };

  const existing = await prisma.player.findUnique({
    where: { userId_tag: { userId: user.id, tag: tag.value } },
    select: { id: true },
  });
  if (existing) redirect("/dashboard");

  let verified = false;
  if (input.data.mode === "verified") {
    if (!input.data.token) {
      return { status: "error", message: "Cole o token da API que o jogo mostrou." };
    }
    const check = await verifyPlayerToken(tag.value, input.data.token);
    if (!check.ok) return { status: "error", message: describeGatewayError(check.error) };
    if (!check.value) {
      return {
        status: "error",
        message:
          "Token recusado pelo jogo. Ele expira em poucos minutos — gere um novo e tente de novo.",
      };
    }
    verified = true;
  }

  const profile = await getPlayer(tag.value);
  if (!profile.ok) return { status: "error", message: describeGatewayError(profile.error) };

  const isFirst = (await prisma.player.count({ where: { userId: user.id } })) === 0;

  const player = await prisma.player.create({
    data: {
      userId: user.id,
      tag: tag.value,
      name: profile.value.name,
      verified,
      verifiedAt: verified ? new Date() : null,
      isPrimary: isFirst,
      // Conta verificada entra na faixa quente do sync; observada, na fria.
      syncPriority: verified ? 1 : 0,
    },
    select: { id: true },
  });

  await persistProfile(player.id, profile.value);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
