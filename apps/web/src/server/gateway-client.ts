import "server-only";

import {
  type PlayerProfileDto,
  canonicalBody,
  playerProfileSchema,
  signedHeaders,
  verifyResponseSchema,
} from "@clashpilot/contracts";
import { type Result, err, ok } from "@clashpilot/core";
import { gatewayUrl } from "@/lib/env";

/**
 * Cliente do gateway. Só roda no servidor: o segredo HMAC nunca pode alcançar o browser —
 * daí o `server-only`, que transforma um import errado em erro de build e não em vazamento.
 */

export type GatewayError =
  | { readonly kind: "notFound" }
  | { readonly kind: "invalidTag" }
  | { readonly kind: "throttled" }
  | { readonly kind: "maintenance" }
  | { readonly kind: "unavailable"; readonly detail: string };

const secret = process.env["COC_GATEWAY_SECRET"] ?? "";

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  parse: (data: unknown) => T,
): Promise<Result<T, GatewayError>> {
  if (secret.length === 0) {
    return err({ kind: "unavailable", detail: "COC_GATEWAY_SECRET não configurado" });
  }

  const payload = canonicalBody(body);
  try {
    const res = await fetch(`${gatewayUrl}${path}`, {
      method,
      headers: {
        ...signedHeaders(secret, method, path, body),
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: payload } : {}),
      cache: "no-store",
    });

    if (res.ok) return ok(parse(await res.json()));

    switch (res.status) {
      case 400:
        return err({ kind: "invalidTag" });
      case 404:
        return err({ kind: "notFound" });
      case 429:
        return err({ kind: "throttled" });
      case 503:
        return err({ kind: "maintenance" });
      default:
        return err({ kind: "unavailable", detail: `gateway respondeu ${res.status}` });
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "erro desconhecido";
    return err({ kind: "unavailable", detail });
  }
}

export function getPlayer(tag: string): Promise<Result<PlayerProfileDto, GatewayError>> {
  return request("GET", `/players/${encodeURIComponent(tag)}`, undefined, (data) =>
    playerProfileSchema.parse(data),
  );
}

export function verifyPlayerToken(
  tag: string,
  token: string,
): Promise<Result<boolean, GatewayError>> {
  return request(
    "POST",
    `/players/${encodeURIComponent(tag)}/verify`,
    { token },
    (data) => verifyResponseSchema.parse(data).verified,
  );
}

export function describeGatewayError(error: GatewayError): string {
  switch (error.kind) {
    case "notFound":
      return "Não encontramos essa vila. Confira a tag no jogo, em Perfil.";
    case "invalidTag":
      return "Essa tag não tem um formato válido.";
    case "throttled":
      return "Muitas consultas agora há pouco. Tente de novo em alguns segundos.";
    case "maintenance":
      return "O Clash of Clans está em manutenção. Tente novamente quando o jogo voltar.";
    case "unavailable":
      return "Não conseguimos falar com o Clash of Clans agora. Tente de novo em instantes.";
  }
}
