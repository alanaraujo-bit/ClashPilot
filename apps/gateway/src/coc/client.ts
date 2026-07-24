import {
  type CocApiError,
  type CocGateway,
  type PlayerProfile,
  type PlayerTag,
  type Result,
  err,
  ok,
  toApiPath,
} from "@clashpilot/core";
import type { GatewayConfig } from "../config.js";
import { cocErrorDto, playerDto, verifyTokenDto } from "./dto.js";
import { mapPlayer } from "./mapper.js";
import { type RateLimiter, createTokenBucket } from "./rate-limiter.js";

/**
 * Cliente da API oficial. É o ÚNICO ponto do sistema que conhece o token da Supercell.
 *
 * Todo erro vira um valor tipado (`CocApiError`) — nada de exceção atravessando camada.
 * Ver docs/01-api-clash.md §1 para o mapeamento dos códigos.
 */
export class CocApiClient implements CocGateway {
  private readonly limiter: RateLimiter;

  constructor(
    private readonly config: GatewayConfig,
    limiter?: RateLimiter,
  ) {
    this.limiter = limiter ?? createTokenBucket(config.COC_RATE_LIMIT_RPS);
  }

  async getPlayer(tag: PlayerTag): Promise<Result<PlayerProfile, CocApiError>> {
    const res = await this.request(`/players/${toApiPath(tag)}`);
    if (!res.ok) return res;

    const parsed = playerDto.safeParse(res.value);
    if (!parsed.success) {
      return err({
        kind: "badSchema",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    return ok(mapPlayer(parsed.data));
  }

  async verifyPlayerToken(tag: PlayerTag, token: string): Promise<Result<boolean, CocApiError>> {
    const res = await this.request(`/players/${toApiPath(tag)}/verifytoken`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return res;

    const parsed = verifyTokenDto.safeParse(res.value);
    if (!parsed.success) {
      return err({ kind: "badSchema", issues: parsed.error.issues.map((i) => i.message) });
    }
    return ok(parsed.data.status === "ok");
  }

  private async request(
    path: string,
    init: { method?: string; body?: string } = {},
  ): Promise<Result<unknown, CocApiError>> {
    await this.limiter.acquire();

    const bases = [this.config.COC_API_BASE_URL];
    if (this.config.COC_FALLBACK_PROXY_URL) bases.push(this.config.COC_FALLBACK_PROXY_URL);

    let lastError: CocApiError = { kind: "network", message: "nenhuma tentativa executada" };

    for (const base of bases) {
      const result = await this.attempt(`${base}${path}`, init);
      if (result.ok) return result;
      lastError = result.error;
      // Só faz sentido tentar o proxy quando a falha é de rede ou de allowlist de IP.
      if (lastError.kind !== "network" && lastError.kind !== "invalidIp") return result;
    }
    return err(lastError);
  }

  private async attempt(
    url: string,
    init: { method?: string; body?: string },
  ): Promise<Result<unknown, CocApiError>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.COC_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${this.config.COC_API_TOKEN}`,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(init.body ? { body: init.body } : {}),
        signal: controller.signal,
      });

      if (response.ok) return ok(await response.json());
      return err(await toApiError(response));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "erro desconhecido";
      return err({ kind: "network", message });
    } finally {
      clearTimeout(timer);
    }
  }
}

async function toApiError(response: Response): Promise<CocApiError> {
  const body = await response.json().catch(() => null);
  const parsed = cocErrorDto.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : "";

  switch (response.status) {
    case 403:
      return reason.includes("invalidIp") ? { kind: "invalidIp" } : { kind: "unauthorized" };
    case 404:
      return { kind: "notFound" };
    case 429: {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      return {
        kind: "throttled",
        retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000,
      };
    }
    case 503:
      return { kind: "maintenance" };
    default:
      return { kind: "network", message: `HTTP ${response.status} ${reason}` };
  }
}
