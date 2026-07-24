import type { Catalog, CatalogEntry } from "@clashpilot/coc-data";
import { describe, expect, it } from "vitest";
import { computeRemainingWork, formatDuration } from "./time-to-max.js";
import { rankByTrack, rankUpgrades } from "./priority-engine.js";

/** Fixture: custo 100/200/300 e tempo 1h/2h/3h por nível, para conferir a conta na mão. */
function entry(
  key: string,
  scoreCategory: CatalogEntry["scoreCategory"],
  countByTownHall?: Record<number, number>,
): CatalogEntry {
  return {
    key,
    name: key,
    ptName: key,
    category: "building",
    scoreCategory,
    village: "home",
    usesBuilder: scoreCategory !== "army",
    ...(countByTownHall ? { countByTownHall } : {}),
    levels: [
      { level: 1, cost: 100, resource: "gold", buildTimeSec: 3_600, minTownHall: 1 },
      { level: 2, cost: 200, resource: "gold", buildTimeSec: 7_200, minTownHall: 1 },
      { level: 3, cost: 300, resource: "gold", buildTimeSec: 10_800, minTownHall: 1 },
    ],
  };
}

const catalog: Catalog = [
  entry("cannon", "defense", { 1: 2 }),
  entry("barbarian", "army"),
  entry("king", "hero"),
];

describe("rankUpgrades", () => {
  it("propõe o próximo nível de cada item, a partir da cópia mais atrasada", () => {
    const candidates = rankUpgrades({
      catalog,
      townHallLevel: 1,
      units: [
        { key: "cannon", level: 3, count: 1 },
        { key: "cannon", level: 1, count: 1 },
      ],
    });
    const cannon = candidates.find((c) => c.key === "cannon");
    // Um canhão está no 3 e outro no 1: a sugestão é subir o atrasado, não o que já está no topo.
    expect(cannon).toMatchObject({ fromLevel: 1, toLevel: 2, costAmount: 200 });
  });

  it("não sugere nada que já esteja no teto do Centro de Vila", () => {
    const candidates = rankUpgrades({
      catalog,
      townHallLevel: 1,
      units: [
        { key: "cannon", level: 3, count: 2 },
        { key: "barbarian", level: 3 },
        { key: "king", level: 3 },
      ],
    });
    expect(candidates).toEqual([]);
  });

  it("ROI é ganho de progresso por dia — upgrade mais rápido ganha do mais lento", () => {
    const [top] = rankUpgrades({ catalog, townHallLevel: 1, units: [] });
    // Nível 1 custa 100 e leva 1h; nível 3 custa 300 e leva 3h. O primeiro nível sempre rende
    // mais por dia, então é ele que encabeça.
    expect(top?.toLevel).toBe(1);
    expect(top?.roiPerDay).toBeGreaterThan(0);
  });

  it("a soma dos ganhos nunca ultrapassa o progresso que falta", () => {
    const candidates = rankUpgrades({ catalog, townHallLevel: 1, units: [] });
    const total = candidates.reduce((acc, c) => acc + c.progressGainBp, 0);
    expect(total).toBeLessThanOrEqual(10_000);
  });

  it("ignora categoria sem fonte de dados — não sugere o que não conhecemos", () => {
    const candidates = rankUpgrades({
      catalog,
      townHallLevel: 1,
      units: [],
      knownCategories: new Set(["army"]),
    });
    expect(candidates.every((c) => c.category === "army")).toBe(true);
  });

  it("separa em trilhas paralelas: construtor, laboratório e herói", () => {
    const tracks = rankByTrack({ catalog, townHallLevel: 1, units: [] });
    expect(tracks.builder[0]?.key).toBe("cannon");
    expect(tracks.lab[0]?.key).toBe("barbarian");
    expect(tracks.hero[0]?.key).toBe("king");
    expect(tracks.forge).toEqual([]);
  });
});

describe("computeRemainingWork", () => {
  it("conta todos os upgrades que faltam, por cópia", () => {
    const remaining = computeRemainingWork({
      catalog,
      townHallLevel: 1,
      units: [],
      builders: 1,
    });
    // 2 canhões × 3 níveis + bárbaro × 3 + rei × 3 = 12
    expect(remaining.upgrades).toBe(12);
    expect(remaining.byCategory.defense).toBe(6);
    expect(remaining.byCategory.hero).toBe(3);
  });

  it("soma o custo por recurso", () => {
    const remaining = computeRemainingWork({ catalog, townHallLevel: 1, units: [], builders: 1 });
    // (100+200+300) × 2 canhões + × bárbaro + × rei = 600 × 4 = 2400
    expect(remaining.costByResource.gold).toBe(2_400);
  });

  it("o tempo total é o da trilha mais lenta, nunca a soma das trilhas", () => {
    const remaining = computeRemainingWork({ catalog, townHallLevel: 1, units: [], builders: 1 });
    const soma = remaining.byTrack.reduce((acc, t) => acc + t.parallelTimeSec, 0);
    expect(remaining.criticalPathSec).toBeLessThan(soma);
    expect(remaining.criticalPathSec).toBe(
      Math.max(...remaining.byTrack.map((t) => t.parallelTimeSec)),
    );
  });

  it("mais construtores reduzem só a trilha do construtor", () => {
    const um = computeRemainingWork({ catalog, townHallLevel: 1, units: [], builders: 1 });
    const cinco = computeRemainingWork({ catalog, townHallLevel: 1, units: [], builders: 5 });

    const builderUm = um.byTrack.find((t) => t.track === "builder")!;
    const builderCinco = cinco.byTrack.find((t) => t.track === "builder")!;
    expect(builderCinco.parallelTimeSec).toBeLessThan(builderUm.parallelTimeSec);

    const labUm = um.byTrack.find((t) => t.track === "lab")!;
    const labCinco = cinco.byTrack.find((t) => t.track === "lab")!;
    expect(labCinco.parallelTimeSec).toBe(labUm.parallelTimeSec);
  });

  it("ocupação menor que 100% aumenta o tempo — é o realismo do ADR de estimativa", () => {
    const perfeito = computeRemainingWork({ catalog, townHallLevel: 1, units: [], builders: 2 });
    const real = computeRemainingWork({
      catalog,
      townHallLevel: 1,
      units: [],
      builders: 2,
      builderOccupancy: 0.5,
    });
    const a = perfeito.byTrack.find((t) => t.track === "builder")!.parallelTimeSec;
    const b = real.byTrack.find((t) => t.track === "builder")!.parallelTimeSec;
    expect(b).toBe(a * 2);
  });
});

describe("formatDuration", () => {
  it("formata em pt-BR e em escalas legíveis", () => {
    expect(formatDuration(0)).toBe("imediato");
    expect(formatDuration(1_800)).toBe("30min");
    expect(formatDuration(5_400)).toBe("1h 30min");
    expect(formatDuration(86_400)).toBe("1 dia");
    expect(formatDuration(950_400)).toBe("11 dias");
    expect(formatDuration(86_400 * 400)).toContain("ano");
  });
});
