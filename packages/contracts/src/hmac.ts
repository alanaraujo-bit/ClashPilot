import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Contrato de assinatura entre `apps/web` (cliente) e `apps/gateway` (servidor).
 *
 * Mora aqui, e não dentro do gateway, porque os dois lados PRECISAM calcular exatamente a
 * mesma string. Quando essa lógica estava duplicada, um `JSON.stringify(undefined ?? "")`
 * de um lado — que devolve `'""'`, não `''` — fez todo GET falhar com 401.
 */

export const SIGNATURE_HEADER = "x-cp-signature";
export const TIMESTAMP_HEADER = "x-cp-timestamp";
export const DEFAULT_WINDOW_MS = 60_000;

/** Forma canônica do corpo. `undefined`/`null` ⇒ string vazia. */
export function canonicalBody(body: unknown): string {
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

/** Payload assinado: timestamp, método, caminho (já URL-encoded) e corpo canônico. */
export function signingPayload(
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  return `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
}

export function sign(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(signingPayload(timestamp, method, path, body))
    .digest("hex");
}

/** Monta os headers do lado do cliente. */
export function signedHeaders(
  secret: string,
  method: string,
  path: string,
  body: unknown,
  now = Date.now(),
): Record<string, string> {
  const timestamp = String(now);
  return {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: sign(secret, timestamp, method, path, canonicalBody(body)),
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "expired" | "mismatch" };

export function verify(params: {
  secret: string;
  signature: string | undefined;
  timestamp: string | undefined;
  method: string;
  path: string;
  body: string;
  now?: number;
  windowMs?: number;
}): VerifyResult {
  const { secret, signature, timestamp, method, path, body } = params;
  if (!signature || !timestamp) return { ok: false, reason: "missing" };

  const ts = Number(timestamp);
  const now = params.now ?? Date.now();
  const windowMs = params.windowMs ?? DEFAULT_WINDOW_MS;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > windowMs)
    return { ok: false, reason: "expired" };

  const a = Buffer.from(sign(secret, timestamp, method, path, body), "utf8");
  const b = Buffer.from(signature, "utf8");
  // Comparação em tempo constante: `===` vazaria o segredo por timing.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}
