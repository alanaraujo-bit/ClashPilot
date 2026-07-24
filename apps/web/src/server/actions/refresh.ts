"use server";

import { canonicalBody, signedHeaders } from "@clashpilot/contracts";
import { revalidatePath } from "next/cache";
import { gatewayUrl } from "@/lib/env";
import { requirePlayerAccess } from "../session";

/**
 * Botão "atualizar agora". Dispara um sync sob demanda no gateway — que tem throttle de 60 s
 * para não deixar o usuário martelar a cota da API.
 */
export type RefreshState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly events: number }
  | { readonly status: "throttled" }
  | { readonly status: "error" };

const secret = process.env["COC_GATEWAY_SECRET"] ?? "";

export async function refreshPlayerAction(
  _prev: RefreshState,
  formData: FormData,
): Promise<RefreshState> {
  const playerId = String(formData.get("playerId") ?? "");
  if (!playerId) return { status: "error" };

  // Garante que o jogador é do usuário antes de gastar uma chamada em nome dele.
  await requirePlayerAccess(playerId);

  const path = `/sync/player/${encodeURIComponent(playerId)}`;
  try {
    const res = await fetch(`${gatewayUrl}${path}`, {
      method: "POST",
      headers: {
        ...signedHeaders(secret, "POST", path, undefined),
        "Content-Type": "application/json",
      },
      body: canonicalBody(undefined),
      cache: "no-store",
    });

    if (res.status === 429) return { status: "throttled" };
    if (!res.ok) return { status: "error" };

    const body = (await res.json()) as { events?: number };
    revalidatePath("/dashboard");
    revalidatePath("/timeline");
    return { status: "done", events: body.events ?? 0 };
  } catch {
    return { status: "error" };
  }
}
