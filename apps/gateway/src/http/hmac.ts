import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Autenticação entre apps/web e apps/gateway.
 *
 * Assinatura sobre `timestamp.method.path.body` com janela curta: sem isso, quem descobrisse a
 * URL do gateway teria a API inteira de graça — e, com ela, nossa cota de rate limit.
 */
export const SIGNATURE_HEADER = "x-cp-signature";
export const TIMESTAMP_HEADER = "x-cp-timestamp";
export const DEFAULT_WINDOW_MS = 60_000;

export function sign(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${path}.${body}`)
    .digest("hex");
}

/**
 * Forma canônica do corpo para assinatura. Precisa ser idêntica dos dois lados.
 *
 * Cuidado que já custou uma sessão de debug: `JSON.stringify(undefined ?? "")` devolve `'""'`
 * (dois caracteres de aspas), não uma string vazia — o que fazia todo GET sem corpo assinar
 * algo diferente do que o cliente assinava.
 */
export function canonicalBody(body: unknown): string {
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body);
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

  const expected = sign(secret, timestamp, method, path, body);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  // Comparação em tempo constante: `===` vazaria o segredo por timing.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}
