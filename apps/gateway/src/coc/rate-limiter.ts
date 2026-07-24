/**
 * Token bucket em memória.
 *
 * O gateway é o único processo que fala com a Supercell, então um bucket local já é global —
 * é exatamente o motivo de ele existir (ADR-001). Quando houver mais de uma réplica, trocar
 * a implementação por Redis mantendo esta interface.
 */
export interface RateLimiter {
  acquire(): Promise<void>;
}

export function createTokenBucket(ratePerSecond: number, burst = ratePerSecond): RateLimiter {
  let tokens = burst;
  let last = Date.now();

  const refill = (): void => {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * ratePerSecond);
    last = now;
  };

  return {
    async acquire(): Promise<void> {
      for (;;) {
        refill();
        if (tokens >= 1) {
          tokens -= 1;
          return;
        }
        const waitMs = Math.ceil(((1 - tokens) / ratePerSecond) * 1000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    },
  };
}
