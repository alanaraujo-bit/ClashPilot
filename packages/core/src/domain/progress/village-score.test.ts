import { describe, expect, it } from "vitest";
import type { MaxProgressResult } from "./max-progress.js";
import { categoryImbalance, computeVillageScore } from "./village-score.js";

const progress = (bps: readonly number[], totalBp: number): MaxProgressResult => ({
  totalBp,
  reliable: true,
  byCategory: bps.map((progressBp, i) => ({
    category: (["defense", "hero", "army", "wall"] as const)[i] ?? "defense",
    progressBp,
    investedCost: progressBp,
    requiredCost: 10_000,
    weight: 0.25,
  })),
});

describe("categoryImbalance", () => {
  it("é 0 quando todas as categorias estão no mesmo patamar", () => {
    expect(categoryImbalance(progress([5000, 5000, 5000], 5000).byCategory)).toBe(0);
  });

  it("cresce com a distorção — é isso que pega a vila torta", () => {
    const equilibrada = categoryImbalance(progress([6000, 5000, 4000], 5000).byCategory);
    const torta = categoryImbalance(progress([10_000, 5000, 0], 5000).byCategory);
    expect(torta).toBeGreaterThan(equilibrada);
  });

  it("é 0 com menos de duas categorias (não há o que comparar)", () => {
    expect(categoryImbalance([])).toBe(0);
    expect(categoryImbalance(progress([4200], 4200).byCategory)).toBe(0);
  });
});

describe("computeVillageScore", () => {
  it("vila perfeita e ativa marca 100", () => {
    const r = computeVillageScore({
      progress: progress([10_000, 10_000], 10_000),
      priorityAdherence: 1,
      activeDays: 14,
      windowDays: 14,
    });
    expect(r.score).toBe(100);
    expect(r.factors).toHaveLength(4);
  });

  it("omite o fator de prioridade sem histórico e redistribui o peso", () => {
    const r = computeVillageScore({
      progress: progress([10_000, 10_000], 10_000),
      priorityAdherence: null,
      activeDays: 14,
      windowDays: 14,
    });
    expect(r.factors.map((f) => f.key)).not.toContain("priority");
    expect(r.factors.reduce((a, f) => a + f.weight, 0)).toBeCloseTo(1, 10);
    expect(r.score).toBe(100);
  });

  it("penaliza vila parada mesmo com progresso alto", () => {
    const ativo = computeVillageScore({
      progress: progress([8000, 8000], 8000),
      priorityAdherence: null,
      activeDays: 14,
      windowDays: 14,
    });
    const parado = computeVillageScore({
      progress: progress([8000, 8000], 8000),
      priorityAdherence: null,
      activeDays: 0,
      windowDays: 14,
    });
    expect(parado.score).toBeLessThan(ativo.score);
  });

  it("penaliza vila torta em relação a uma equilibrada de mesmo progresso", () => {
    const equilibrada = computeVillageScore({
      progress: progress([5000, 5000], 5000),
      priorityAdherence: null,
      activeDays: 7,
      windowDays: 14,
    });
    const torta = computeVillageScore({
      progress: progress([10_000, 0], 5000),
      priorityAdherence: null,
      activeDays: 7,
      windowDays: 14,
    });
    expect(torta.score).toBeLessThan(equilibrada.score);
  });

  it("propaga reliable=false do progresso", () => {
    const r = computeVillageScore({
      progress: { totalBp: 0, byCategory: [], reliable: false },
      priorityAdherence: null,
      activeDays: 0,
      windowDays: 14,
    });
    expect(r.reliable).toBe(false);
  });

  it("nunca sai da faixa 0..100", () => {
    const r = computeVillageScore({
      progress: progress([0, 0], 0),
      priorityAdherence: 0,
      activeDays: 0,
      windowDays: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
