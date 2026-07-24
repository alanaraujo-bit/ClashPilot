import { prisma } from "@clashpilot/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

/**
 * Autorização. Toda Server Action que toca dados de jogador começa por `requirePlayerAccess`
 * (docs/04-auth.md §4) — sem isso, um `playerId` na URL viraria IDOR.
 *
 * `cache()` deduplica a leitura de sessão dentro do mesmo render: várias seções do dashboard
 * chamam isto e só uma consulta acontece.
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

export type PlayerAccess = {
  readonly id: string;
  readonly tag: string;
  readonly name: string;
  readonly verified: boolean;
  readonly userId: string;
};

/** Resolve o jogador garantindo que ele pertence ao usuário da sessão. */
export async function requirePlayerAccess(playerId: string): Promise<PlayerAccess> {
  const user = await requireUser();
  const player = await prisma.player.findFirst({
    where: { id: playerId, userId: user.id },
    select: { id: true, tag: true, name: true, verified: true, userId: true },
  });
  // Mesma resposta para "não existe" e "não é seu": não vazamos a existência de contas alheias.
  if (!player) redirect("/dashboard");
  return player;
}

/** Jogador principal do usuário, ou `null` quando ele ainda não vinculou nenhuma vila. */
export async function getPrimaryPlayer() {
  const user = await requireUser();
  return prisma.player.findFirst({
    where: { userId: user.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: { current: true },
  });
}
