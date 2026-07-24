import { SCORE_FACTOR_WEIGHTS } from "@clashpilot/coc-data";
import type { CategoryProgress, MaxProgressResult } from "./max-progress.js";

/**
 * Village Score 0–100 (docs/06-inteligencia.md §2).
 *
 * MAX% mede *quanto falta*. O Score mede *quão bem construída* a vila está: penaliza vila
 * torta (defesa máxima com herói nível 30) e vila parada. Nunca é exibido sem o breakdown —
 * ADR-008.
 */

export interface VillageScoreInput {
  readonly progress: MaxProgressResult;
  /**
   * Aderência à ordem ideal de investimento, 0..1. `null` enquanto não houver histórico
   * suficiente (< 30 dias) — o peso é redistribuído em vez de assumir um valor inventado.
   */
  readonly priorityAdherence: number | null;
  /** Dias com atividade na janela de recência, 0..RECENCY_WINDOW_DAYS. */
  readonly activeDays: number;
  readonly windowDays: number;
}

export interface VillageScoreFactor {
  readonly key: "base" | "balance" | "priority" | "recency";
  readonly label: string;
  /** Valor do fator em 0..100. */
  readonly value: number;
  /** Peso já renormalizado. */
  readonly weight: number;
}

export interface VillageScoreResult {
  readonly score: number;
  readonly factors: readonly VillageScoreFactor[];
  readonly reliable: boolean;
}

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

/** Desvio-padrão populacional das completudes por categoria, em pontos percentuais. */
export function categoryImbalance(byCategory: readonly CategoryProgress[]): number {
  if (byCategory.length < 2) return 0;
  const values = byCategory.map((c) => c.progressBp / 100);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeVillageScore(input: VillageScoreInput): VillageScoreResult {
  const { progress, priorityAdherence, activeDays, windowDays } = input;

  const base = progress.totalBp / 100;
  const balance = clamp(100 - categoryImbalance(progress.byCategory), 0, 100);
  const recency = windowDays > 0 ? clamp((activeDays / windowDays) * 100, 0, 100) : 0;

  const raw: { key: VillageScoreFactor["key"]; label: string; value: number; weight: number }[] = [
    {
      key: "base",
      label: "Progresso até o máximo",
      value: base,
      weight: SCORE_FACTOR_WEIGHTS.base,
    },
    {
      key: "balance",
      label: "Equilíbrio entre categorias",
      value: balance,
      weight: SCORE_FACTOR_WEIGHTS.balance,
    },
    {
      key: "recency",
      label: "Atividade recente",
      value: recency,
      weight: SCORE_FACTOR_WEIGHTS.recency,
    },
  ];

  if (priorityAdherence !== null) {
    raw.push({
      key: "priority",
      label: "Aderência à ordem ideal",
      value: clamp(priorityAdherence * 100, 0, 100),
      weight: SCORE_FACTOR_WEIGHTS.priority,
    });
  }

  const weightSum = raw.reduce((acc, f) => acc + f.weight, 0);
  const factors: VillageScoreFactor[] = raw.map((f) => ({
    key: f.key,
    label: f.label,
    value: Math.round(f.value * 10) / 10,
    weight: f.weight / weightSum,
  }));

  const score = Math.round(factors.reduce((acc, f) => acc + f.value * f.weight, 0));

  return { score: clamp(score, 0, 100), factors, reliable: progress.reliable };
}
