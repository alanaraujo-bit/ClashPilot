import type { ScoreCategory } from "./types.js";

/**
 * Pesos por categoria no cálculo de progresso MAX (docs/06-inteligencia.md §1).
 *
 * Mudar um peso muda o histórico. Por isso todo snapshot grava `SCORE_VERSION`: um número
 * antigo continua interpretável, e recalcular a série inteira é uma decisão explícita.
 */
export const SCORE_VERSION = 1;

export const CATEGORY_WEIGHTS: Readonly<Record<ScoreCategory, number>> = {
  defense: 0.22,
  wall: 0.1,
  army: 0.18,
  hero: 0.2,
  pet: 0.07,
  equipment: 0.08,
  trap: 0.05,
  infrastructure: 0.1,
};

/** Pesos do Village Score sobre seus quatro fatores (docs/06-inteligencia.md §2). */
export const SCORE_FACTOR_WEIGHTS = {
  base: 0.55,
  balance: 0.2,
  priority: 0.15,
  recency: 0.1,
} as const;

/** Janela, em dias, usada pelo fator de atividade recente do Village Score. */
export const RECENCY_WINDOW_DAYS = 14;

const sum = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
/* c8 ignore next 3 */
if (Math.abs(sum - 1) > 1e-9) {
  throw new Error(`CATEGORY_WEIGHTS deve somar 1, somou ${sum}`);
}
