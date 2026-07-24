import type { Catalog, CatalogEntry } from "@clashpilot/coc-data";
import { describe, expect, it } from "vitest";
import { API_KNOWN_CATEGORIES, computeMaxProgress } from "./max-progress.js";
import { knownCategoriesFrom, ledgerSlotsForTownHall, ledgerToUnits } from "./ledger.js";

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
    usesBuilder: true,
    ...(countByTownHall ? { countByTownHall } : {}),
    levels: [
      { level: 1, cost: 100, resource: "gold", buildTimeSec: 60, minTownHall: 1 },
      { level: 2, cost: 200, resource: "gold", buildTimeSec: 120, minTownHall: 1 },
      { level: 3, cost: 300, resource: "gold", buildTimeSec: 180, minTownHall: 5 },
    ],
  };
}

const catalog: Catalog = [
  entry("cannon", "defense", { 1: 2, 5: 4 }),
  entry("wall", "wall", { 1: 50 }),
  entry("king", "hero"),
];

describe("ledgerSlotsForTownHall", () => {
  it("lista só o que o jogador precisa declarar — herói vem da API", () => {
    const slots = ledgerSlotsForTownHall(catalog, 5);
    expect(slots.map((s) => s.key)).toEqual(["cannon", "wall"]);
  });

  it("traz a quantidade e o nível máximo do TH atual", () => {
    const [cannon] = ledgerSlotsForTownHall(catalog, 5);
    expect(cannon).toMatchObject({ quantity: 4, maxLevel: 3 });

    const [cannonAtTh1] = ledgerSlotsForTownHall(catalog, 1);
    expect(cannonAtTh1).toMatchObject({ quantity: 2, maxLevel: 2 });
  });
});

describe("ledgerToUnits", () => {
  it("descarta linhas em nível 0 — prédio não construído não vira unidade", () => {
    const units = ledgerToUnits([
      { buildingKey: "cannon", slot: 1, level: 3, count: 1 },
      { buildingKey: "cannon", slot: 2, level: 0, count: 1 },
      { buildingKey: "wall", slot: 0, level: 5, count: 0 },
    ]);
    expect(units).toEqual([{ key: "cannon", level: 3, count: 1 }]);
  });
});

describe("integração com o progresso", () => {
  it("declarar uma categoria leva a cobertura de parcial para total", () => {
    const units = [{ key: "king", level: 3 }];

    const semLedger = computeMaxProgress({
      catalog,
      townHallLevel: 5,
      units,
      knownCategories: API_KNOWN_CATEGORIES,
    });
    expect([...semLedger.unknownCategories].sort()).toEqual(["defense", "wall"]);
    expect(semLedger.coverageBp).toBeLessThan(10_000);

    const comLedger = computeMaxProgress({
      catalog,
      townHallLevel: 5,
      units: [
        ...units,
        ...ledgerToUnits([
          { buildingKey: "cannon", slot: 1, level: 3, count: 4 },
          { buildingKey: "wall", slot: 0, level: 3, count: 50 },
        ]),
      ],
      knownCategories: knownCategoriesFrom(API_KNOWN_CATEGORIES, ["defense", "wall"]),
    });

    expect(comLedger.unknownCategories).toEqual([]);
    expect(comLedger.coverageBp).toBe(10_000);
    expect(comLedger.totalBp).toBe(10_000);
  });

  it("muralha usa contagem por nível e respeita o total do TH", () => {
    const parcial = computeMaxProgress({
      catalog,
      townHallLevel: 5,
      units: ledgerToUnits([{ buildingKey: "wall", slot: 0, level: 3, count: 25 }]),
      knownCategories: new Set(["wall"]),
    });
    // 25 de 50 peças no topo ⇒ metade do custo investido.
    expect(parcial.byCategory[0]?.progressBp).toBe(5_000);
  });
});
