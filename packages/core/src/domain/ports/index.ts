import type { Result } from "../../shared/result.js";
import type { PlayerTag } from "../player/player-tag.js";
import type { PlayerProfile } from "../player/player.types.js";

/**
 * Ports do domínio. A infraestrutura implementa estas interfaces; o domínio nunca conhece
 * Prisma, fetch, Redis ou Next.js. É o que torna a regra de dependência verificável.
 */

export type CocApiError =
  | { readonly kind: "notFound" }
  | { readonly kind: "throttled"; readonly retryAfterMs: number }
  | { readonly kind: "maintenance" }
  | { readonly kind: "invalidIp" }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "network"; readonly message: string }
  | { readonly kind: "badSchema"; readonly issues: readonly string[] };

export interface CocGateway {
  getPlayer(tag: PlayerTag): Promise<Result<PlayerProfile, CocApiError>>;
  /** `POST /players/{tag}/verifytoken` — prova de propriedade da conta. */
  verifyPlayerToken(tag: PlayerTag, token: string): Promise<Result<boolean, CocApiError>>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Invalidação por tag — usada pelo sync para derrubar tudo de um jogador de uma vez. */
  invalidateTag(tag: string): Promise<void>;
}

/** Nada de `new Date()` solto no domínio: tempo é dependência, senão o teste vira loteria. */
export interface ClockPort {
  now(): Date;
}

export const systemClock: ClockPort = { now: () => new Date() };

export interface LlmPort {
  /** Redige a explicação a partir de um resultado JÁ calculado. Nunca calcula (ADR-007). */
  explain(input: {
    readonly question: string;
    readonly structured: unknown;
    readonly locale: string;
  }): Promise<Result<string, { readonly kind: "unavailable" | "quota" | "network" }>>;
}
