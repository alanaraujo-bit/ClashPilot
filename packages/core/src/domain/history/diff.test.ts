import { describe, expect, it } from "vitest";
import type { PlayerProfile, PlayerUnit } from "../player/player.types.js";
import type { PlayerTag } from "../player/player-tag.js";
import { diffProfiles, extractLootTotals } from "./diff.js";

function unit(
  over: Partial<PlayerUnit> & Pick<PlayerUnit, "key" | "level" | "category">,
): PlayerUnit {
  return { name: over.key, village: "home", globalMaxLevel: 99, ...over };
}

function profile(over: Partial<PlayerProfile>): PlayerProfile {
  return {
    tag: "#2PP" as PlayerTag,
    name: "Alan",
    townHallLevel: 10,
    expLevel: 100,
    trophies: 2000,
    bestTrophies: 2500,
    warStars: 0,
    attackWins: 0,
    defenseWins: 0,
    donations: 0,
    donationsReceived: 0,
    clanCapitalContributions: 0,
    units: [],
    achievements: [],
    ...over,
  };
}

describe("diffProfiles", () => {
  it("registra subida de Centro de Vila", () => {
    const events = diffProfiles(profile({ townHallLevel: 10 }), profile({ townHallLevel: 11 }));
    expect(events).toContainEqual({ type: "th_up", fromLevel: 10, toLevel: 11 });
  });

  it("registra level up de herói com o nível anterior correto", () => {
    const before = profile({
      units: [unit({ key: "barbarian-king", level: 40, category: "hero" })],
    });
    const after = profile({
      units: [unit({ key: "barbarian-king", level: 42, category: "hero" })],
    });
    const events = diffProfiles(before, after);
    expect(events).toContainEqual({
      type: "hero_level_up",
      key: "barbarian-king",
      name: "barbarian-king",
      fromLevel: 40,
      toLevel: 42,
    });
  });

  it("trata unidade nova (ausente antes) como vinda do nível 0", () => {
    const after = profile({ units: [unit({ key: "dragon", level: 1, category: "troop" })] });
    const events = diffProfiles(profile({}), after);
    expect(events).toContainEqual({
      type: "troop_level_up",
      key: "dragon",
      name: "dragon",
      fromLevel: 0,
      toLevel: 1,
    });
  });

  it("não gera evento quando nada muda", () => {
    const p = profile({ units: [unit({ key: "wizard", level: 5, category: "troop" })] });
    expect(diffProfiles(p, p)).toEqual([]);
  });

  it("ignora Builder Base e Super Tropa ativa", () => {
    const before = profile({});
    const after = profile({
      units: [
        unit({ key: "raged-barbarian", level: 18, category: "troop", village: "builderBase" }),
        unit({ key: "ice-hound", level: 5, category: "troop", superTroopActive: true }),
      ],
    });
    expect(diffProfiles(before, after)).toEqual([]);
  });

  it("registra mudança de liga", () => {
    const before = profile({ league: { id: 1, name: "Ouro" } });
    const after = profile({ league: { id: 2, name: "Cristal" } });
    const events = diffProfiles(before, after);
    expect(events.find((e) => e.type === "league_change")?.meta).toEqual({
      from: "Ouro",
      to: "Cristal",
    });
  });

  it("registra pico de troféus só quando o recorde pessoal sobe", () => {
    // Troféus da temporada oscilam; só o melhor recorde vira evento.
    const semRecorde = diffProfiles(
      profile({ trophies: 2000, bestTrophies: 2500 }),
      profile({ trophies: 2400, bestTrophies: 2500 }),
    );
    expect(semRecorde.find((e) => e.type === "trophy_peak")).toBeUndefined();

    const comRecorde = diffProfiles(
      profile({ bestTrophies: 2500 }),
      profile({ bestTrophies: 2600 }),
    );
    expect(comRecorde.find((e) => e.type === "trophy_peak")).toMatchObject({
      delta: 100,
      toLevel: 2600,
    });
  });

  it("registra troca de clã, incluindo saída", () => {
    const before = profile({ clan: { tag: "#A", name: "Alpha", level: 5 } });
    const after = profile({});
    expect(diffProfiles(before, after).find((e) => e.type === "clan_change")?.meta).toEqual({
      from: "Alpha",
      to: "sem clã",
    });
  });
});

describe("extractLootTotals", () => {
  it("lê as séries cumulativas dos achievements", () => {
    const p = profile({
      achievements: [
        { name: "Gold Grab", stars: 3, value: 1_000_000, target: 2_000_000, scope: "home" },
        { name: "Heroic Heist", stars: 3, value: 50_000, target: 100_000, scope: "home" },
      ],
    });
    expect(extractLootTotals(p)).toEqual({ goldLootTotal: 1_000_000, darkLootTotal: 50_000 });
  });
});
