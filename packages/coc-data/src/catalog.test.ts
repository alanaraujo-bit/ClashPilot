import { describe, expect, it } from "vitest";
import {
  CATALOG,
  CATEGORY_WEIGHTS,
  MAX_TOWN_HALL,
  TOWN_HALLS,
  countAtTownHall,
  cumulativeBuildTime,
  cumulativeCost,
  findEntry,
  isValidTownHall,
  maxLevelForTownHall,
  townHall,
} from "./index.js";
import type { CatalogEntry } from "./types.js";

const cannon: CatalogEntry = {
  key: "cannon",
  name: "Cannon",
  ptName: "Canhão",
  category: "building",
  scoreCategory: "defense",
  village: "home",
  usesBuilder: true,
  countByTownHall: { 1: 2, 3: 3, 5: 4, 7: 5, 9: 6, 11: 7 },
  levels: [
    { level: 1, cost: 250, resource: "gold", buildTimeSec: 60, minTownHall: 1 },
    { level: 2, cost: 1000, resource: "gold", buildTimeSec: 900, minTownHall: 1 },
    { level: 3, cost: 4000, resource: "gold", buildTimeSec: 3600, minTownHall: 2 },
    { level: 4, cost: 16000, resource: "gold", buildTimeSec: 10800, minTownHall: 3 },
  ],
};

describe("integridade da tabela de Centros de Vila", () => {
  it("cobre 1..MAX sem lacuna e em ordem", () => {
    expect(TOWN_HALLS).toHaveLength(MAX_TOWN_HALL);
    TOWN_HALLS.forEach((th, i) => expect(th.level).toBe(i + 1));
  });

  it("o Laboratório abre no TH3 e segue nivel = th - 2", () => {
    for (const th of TOWN_HALLS) {
      expect(th.labLevel).toBe(th.level < 3 ? null : th.level - 2);
    }
  });

  it("contagem e nível de muralha nunca regridem", () => {
    for (let i = 1; i < TOWN_HALLS.length; i++) {
      const prev = TOWN_HALLS[i - 1]!;
      const curr = TOWN_HALLS[i]!;
      expect(curr.wallCount).toBeGreaterThanOrEqual(prev.wallCount);
      expect(curr.wallMaxLevel).toBeGreaterThanOrEqual(prev.wallMaxLevel);
    }
  });

  it("valida limites de TH", () => {
    expect(isValidTownHall(0)).toBe(false);
    expect(isValidTownHall(MAX_TOWN_HALL)).toBe(true);
    expect(isValidTownHall(MAX_TOWN_HALL + 1)).toBe(false);
    expect(isValidTownHall(9.5)).toBe(false);
    expect(townHall(14)?.labLevel).toBe(12);
    expect(townHall(99)).toBeUndefined();
  });
});

describe("pesos de categoria", () => {
  it("somam exatamente 1", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("helpers do catálogo", () => {
  it("maxLevelForTownHall respeita minTownHall", () => {
    expect(maxLevelForTownHall(cannon, 1)).toBe(2);
    expect(maxLevelForTownHall(cannon, 2)).toBe(3);
    expect(maxLevelForTownHall(cannon, 17)).toBe(4);
  });

  it("cumulativeCost e cumulativeBuildTime somam do nível 1 até o alvo", () => {
    expect(cumulativeCost(cannon, 0)).toBe(0);
    expect(cumulativeCost(cannon, 2)).toBe(1250);
    expect(cumulativeCost(cannon, 4)).toBe(21250);
    expect(cumulativeBuildTime(cannon, 3)).toBe(4560);
  });

  it("countAtTownHall usa o maior degrau já alcançado", () => {
    expect(countAtTownHall(cannon, 1)).toBe(2);
    expect(countAtTownHall(cannon, 4)).toBe(3);
    expect(countAtTownHall(cannon, 17)).toBe(7);
  });

  it("countAtTownHall assume 1 unidade quando não há tabela de quantidade", () => {
    const lab: CatalogEntry = {
      key: "laboratory",
      name: "Laboratory",
      ptName: "Laboratório",
      category: "building",
      scoreCategory: "infrastructure",
      village: "home",
      usesBuilder: false,
      levels: cannon.levels,
    };
    expect(countAtTownHall(lab, 5)).toBe(1);
  });

  it("findEntry devolve undefined para chave inexistente", () => {
    expect(findEntry(CATALOG, "nao-existe")).toBeUndefined();
    expect(findEntry([cannon], "cannon")).toBe(cannon);
  });
});
