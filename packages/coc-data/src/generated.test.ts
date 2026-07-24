import { describe, expect, it } from "vitest";
import { CATALOG, MAX_TOWN_HALL, TOWN_HALLS, findEntry, maxLevelForTownHall } from "./index.js";

/**
 * Testes de integridade do catálogo gerado.
 *
 * Dois papéis:
 *  1. **Travar valores conhecidos.** Se a semântica dos arquivos da Supercell mudar (custo
 *     "para atingir" virar "para sair", por exemplo), todos os números do app deslocam um
 *     nível em silêncio. Estes testes quebram antes disso chegar ao usuário.
 *  2. **Garantir invariantes estruturais** que o motor de progresso assume.
 */

const entry = (key: string) => {
  const found = findEntry(CATALOG, key);
  if (!found) throw new Error(`item "${key}" ausente do catálogo`);
  return found;
};

const levelOf = (key: string, level: number) => {
  const spec = entry(key).levels.find((l) => l.level === level);
  if (!spec) throw new Error(`"${key}" não tem nível ${level}`);
  return spec;
};

describe("valores travados contra o jogo", () => {
  it("prédio: o custo é para ATINGIR o nível (Canhão 1 = 250 de ouro)", () => {
    expect(levelOf("cannon", 1)).toMatchObject({ cost: 250, resource: "gold", minTownHall: 1 });
    expect(levelOf("cannon", 2)).toMatchObject({ cost: 1_000, resource: "gold", minTownHall: 2 });
  });

  it("prédio: Acampamento nível 1 custa 200 de elixir", () => {
    expect(levelOf("troop-housing", 1)).toMatchObject({ cost: 200, resource: "elixir" });
  });

  it("tropa: nível 1 é grátis e o custo é para SAIR do nível (Bárbaro 1→2 = 10.000)", () => {
    expect(levelOf("barbarian", 1).cost).toBe(0);
    expect(levelOf("barbarian", 2)).toMatchObject({ cost: 10_000, resource: "elixir" });
  });

  it("tropa: Bárbaro vai até o nível 13 — o mesmo maxLevel que a API devolve", () => {
    const levels = entry("barbarian").levels.map((l) => l.level);
    expect(Math.max(...levels)).toBe(13);
  });

  it("herói: o nível 1 é o custo do altar (Rei Bárbaro = 5.000 de elixir negro no TH7)", () => {
    expect(levelOf("barbarian-king", 1)).toMatchObject({
      cost: 5_000,
      resource: "darkElixir",
      minTownHall: 7,
    });
  });

  it("equipamento: custo em minério, não em ouro", () => {
    const first = entry("barbarian-crown").levels[0];
    expect(first?.cost).toBe(120);
    expect(first?.resource).toBe("commonOre");
  });

  it("tropa/feitiço é gateado pelo prédio produtor, não só pelo Laboratório", () => {
    // Bug real pego na 1ª validação contra conta TH6: o gating só pelo Lab liberava tropas de
    // elixir negro em THs que nem têm Quartel de Elixir Negro. O unlock verdadeiro vem do prédio
    // que PRODUZ a unidade (Golem = Dark Elixir Barrack nv4 = TH8; Bowler = nv7 = TH10).
    expect(levelOf("golem", 1).minTownHall).toBe(8);
    expect(levelOf("bowler", 1).minTownHall).toBe(10);
    expect(levelOf("ice-golem", 1).minTownHall).toBe(11);
    expect(levelOf("poison", 1).minTownHall).toBe(8); // Mini Spell Factory (TH8)
    expect(levelOf("pekka", 1).minTownHall).toBe(8); // Barrack nv10 (TH8)
    expect(levelOf("siege-machine-ram", 1).minTownHall).toBe(12); // SiegeWorkshop (TH12)
  });

  it("nenhum custo em elixir negro aparece antes do TH7 (Quartel de Elixir Negro)", () => {
    for (const item of CATALOG) {
      for (const level of item.levels) {
        if (level.resource === "darkElixir") {
          expect(level.minTownHall, `${item.key} nível ${level.level}`).toBeGreaterThanOrEqual(7);
        }
      }
    }
  });

  it("os cinco heróis da vila principal estão presentes", () => {
    const heroes = CATALOG.filter((e) => e.category === "hero").map((e) => e.key);
    expect(heroes).toContain("barbarian-king");
    expect(heroes).toContain("archer-queen");
    expect(heroes).toHaveLength(5);
  });
});

describe("tabela de Centros de Vila derivada dos dados", () => {
  it("cobre 1..MAX sem lacuna e está marcada como verificada", () => {
    expect(TOWN_HALLS).toHaveLength(MAX_TOWN_HALL);
    TOWN_HALLS.forEach((th, i) => {
      expect(th.level).toBe(i + 1);
      expect(th.verified).toBe(true);
    });
  });

  it("o Laboratório abre no TH3 e segue nível = th - 2", () => {
    for (const th of TOWN_HALLS) {
      expect(th.labLevel).toBe(th.level < 3 ? null : th.level - 2);
    }
  });

  it("contagem e nível de muralha nunca regridem", () => {
    for (let i = 1; i < TOWN_HALLS.length; i++) {
      expect(TOWN_HALLS[i]!.wallCount).toBeGreaterThanOrEqual(TOWN_HALLS[i - 1]!.wallCount);
      expect(TOWN_HALLS[i]!.wallMaxLevel).toBeGreaterThanOrEqual(TOWN_HALLS[i - 1]!.wallMaxLevel);
    }
  });
});

describe("invariantes estruturais que o motor de progresso assume", () => {
  it("todo item tem níveis em ordem crescente e sem repetição", () => {
    for (const item of CATALOG) {
      const levels = item.levels.map((l) => l.level);
      expect(levels, item.key).toEqual([...levels].sort((a, b) => a - b));
      expect(new Set(levels).size, item.key).toBe(levels.length);
    }
  });

  it("o Centro de Vila mínimo nunca regride dentro de um item", () => {
    for (const item of CATALOG) {
      for (let i = 1; i < item.levels.length; i++) {
        expect(
          item.levels[i]!.minTownHall,
          `${item.key} nível ${item.levels[i]!.level}`,
        ).toBeGreaterThanOrEqual(item.levels[i - 1]!.minTownHall);
      }
    }
  });

  it("nenhum custo é negativo e nenhum item usa gemas", () => {
    for (const item of CATALOG) {
      for (const level of item.levels) {
        expect(level.cost, item.key).toBeGreaterThanOrEqual(0);
        expect(level.resource, item.key).not.toBe("gems");
      }
    }
  });

  it("as chaves são únicas", () => {
    const keys = CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("as oito categorias de score estão representadas", () => {
    const categories = new Set(CATALOG.map((e) => e.scoreCategory));
    expect([...categories].sort()).toEqual([
      "army",
      "defense",
      "equipment",
      "hero",
      "infrastructure",
      "pet",
      "trap",
      "wall",
    ]);
  });

  it("maxLevelForTownHall cresce com o TH e nunca passa do último nível", () => {
    const cannon = entry("cannon");
    const last = cannon.levels.at(-1)!.level;
    let previous = 0;
    for (let th = 1; th <= MAX_TOWN_HALL; th++) {
      const max = maxLevelForTownHall(cannon, th);
      expect(max).toBeGreaterThanOrEqual(previous);
      expect(max).toBeLessThanOrEqual(last);
      previous = max;
    }
    expect(maxLevelForTownHall(cannon, MAX_TOWN_HALL)).toBe(last);
  });
});
