import type { Catalog, CatalogEntry } from "@clashpilot/coc-data";
import { describe, expect, it } from "vitest";
import { computeMaxProgress, formatBp } from "./max-progress.js";

/** Catálogo-fixture: 3 níveis de custo 100/200/300 por item, para a conta ser conferível na mão. */
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

const catalog: Catalog = [entry("cannon", "defense", { 1: 2 }), entry("king", "hero")];

describe("computeMaxProgress", () => {
  it("é 0% com a vila zerada e 100% com tudo no teto do TH", () => {
    const empty = computeMaxProgress({ catalog, townHallLevel: 1, units: [] });
    expect(empty.totalBp).toBe(0);
    expect(empty.reliable).toBe(true);

    const full = computeMaxProgress({
      catalog,
      townHallLevel: 1,
      units: [
        { key: "cannon", level: 2, count: 2 },
        { key: "king", level: 2 },
      ],
    });
    expect(full.totalBp).toBe(10_000);
  });

  it("usa o teto DO TH ATUAL, não o máximo global do item", () => {
    // No TH1 o nível 3 não existe: 2 canhões no nível 2 já são 100% de defesa.
    const r = computeMaxProgress({
      catalog,
      townHallLevel: 1,
      units: [{ key: "cannon", level: 2, count: 2 }],
    });
    const defense = r.byCategory.find((c) => c.category === "defense");
    expect(defense?.progressBp).toBe(10_000);

    // No TH5 o teto sobe para 3 e os mesmos canhões passam a valer 300/600.
    const th5 = computeMaxProgress({
      catalog,
      townHallLevel: 5,
      units: [{ key: "cannon", level: 2, count: 2 }],
    });
    expect(th5.byCategory.find((c) => c.category === "defense")?.progressBp).toBe(5_000);
  });

  it("pondera por custo acumulado, não por nível", () => {
    // Nível 2 de 3 = 66% dos níveis, mas 300/600 = 50% do custo.
    const r = computeMaxProgress({
      catalog,
      townHallLevel: 5,
      units: [{ key: "king", level: 2 }],
    });
    expect(r.byCategory.find((c) => c.category === "hero")?.progressBp).toBe(5_000);
  });

  it("conta instância não declarada como nível 0, mas mantém no denominador", () => {
    // Só 1 dos 2 canhões declarado, no teto.
    const r = computeMaxProgress({
      catalog,
      townHallLevel: 1,
      units: [{ key: "cannon", level: 2, count: 1 }],
    });
    expect(r.byCategory.find((c) => c.category === "defense")?.progressBp).toBe(5_000);
  });

  it("não dá crédito acima do teto do TH", () => {
    const r = computeMaxProgress({
      catalog,
      townHallLevel: 1,
      units: [{ key: "king", level: 99 }],
    });
    expect(r.byCategory.find((c) => c.category === "hero")?.progressBp).toBe(10_000);
  });

  it("renormaliza os pesos sobre as categorias existentes", () => {
    // defense (0,22) e hero (0,20) somam 0,42. Defesa 100% e herói 0% ⇒ 0,22/0,42 = 52,38%.
    const r = computeMaxProgress({
      catalog,
      townHallLevel: 1,
      units: [{ key: "cannon", level: 2, count: 2 }],
    });
    expect(r.totalBp).toBe(5_238);
  });

  it("marca reliable=false quando o catálogo ainda está vazio (Fase 3 pendente)", () => {
    const r = computeMaxProgress({ catalog: [], townHallLevel: 14, units: [] });
    expect(r.reliable).toBe(false);
    expect(r.totalBp).toBe(0);
    expect(r.byCategory).toHaveLength(0);
  });
});

describe("formatBp", () => {
  it("formata em pt-BR com vírgula decimal", () => {
    expect(formatBp(7240)).toBe("72,4%");
    expect(formatBp(10_000)).toBe("100,0%");
    expect(formatBp(0)).toBe("0,0%");
  });
});
