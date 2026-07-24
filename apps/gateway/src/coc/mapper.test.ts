import { describe, expect, it } from "vitest";
import { playerDto } from "./dto.js";
import { mapPlayer, progressUnits } from "./mapper.js";

/** Payload no formato real da API, reduzido ao que exercita as regras do mapper. */
const raw = {
  tag: "#2PP",
  name: "Alan",
  townHallLevel: 14,
  townHallWeaponLevel: 5,
  expLevel: 187,
  trophies: 3120,
  bestTrophies: 3450,
  warStars: 812,
  attackWins: 41,
  defenseWins: 12,
  donations: 1204,
  donationsReceived: 980,
  clanCapitalContributions: 145000,
  league: { id: 29000022, name: "Legend League", iconUrls: { medium: "https://x/l.png" } },
  clan: { tag: "#XYZ", name: "Clã", clanLevel: 18, badgeUrls: { medium: "https://x/b.png" } },
  achievements: [
    { name: "Empire Builder", stars: 3, value: 9, target: 10, village: "home" },
    { name: "Bigger Coffers", stars: 3, value: 14, target: 15, village: "home" },
  ],
  troops: [
    { name: "Barbarian", level: 10, maxLevel: 12, village: "home" },
    { name: "Ice Hound", level: 4, maxLevel: 5, village: "home", superTroopIsActive: true },
    { name: "Mighty Yak", level: 10, maxLevel: 10, village: "home" },
    { name: "Wall Wrecker", level: 4, maxLevel: 4, village: "home" },
    { name: "Raged Barbarian", level: 18, maxLevel: 18, village: "builderBase" },
  ],
  spells: [{ name: "Lightning Spell", level: 9, maxLevel: 11, village: "home" }],
  heroes: [
    {
      name: "Barbarian King",
      level: 75,
      maxLevel: 80,
      village: "home",
      equipment: [{ name: "Barbarian Puppet", level: 18, maxLevel: 27, village: "home" }],
    },
  ],
  heroEquipment: [
    { name: "Barbarian Puppet", level: 18, maxLevel: 27, village: "home" },
    { name: "Giant Gauntlet", level: 9, maxLevel: 27, village: "home" },
  ],
};

const profile = mapPlayer(playerDto.parse(raw));
const byKey = (key: string) => profile.units.find((u) => u.key === key);

describe("mapPlayer", () => {
  it("normaliza a tag e os campos básicos", () => {
    expect(profile.tag).toBe("#2PP");
    expect(profile.townHallLevel).toBe(14);
    expect(profile.league?.iconUrl).toBe("https://x/l.png");
    expect(profile.clan?.level).toBe(18);
  });

  it("reclassifica pets e cercos que vêm dentro de troops", () => {
    expect(byKey("mighty-yak")?.category).toBe("pet");
    expect(byKey("wall-wrecker")?.category).toBe("siege");
    expect(byKey("barbarian")?.category).toBe("troop");
  });

  it("preserva maxLevel da API como globalMaxLevel, nunca como teto de progresso", () => {
    expect(byKey("barbarian")?.globalMaxLevel).toBe(12);
  });

  it("deduplica equipamento que aparece no herói e em heroEquipment", () => {
    const puppets = profile.units.filter((u) => u.key === "barbarian-puppet");
    expect(puppets).toHaveLength(1);
    expect(byKey("giant-gauntlet")?.category).toBe("equipment");
  });

  it("marca Super Tropa ativa e a exclui do progresso permanente", () => {
    expect(byKey("ice-hound")?.superTroopActive).toBe(true);
    const keys = progressUnits(profile).map((u) => u.key);
    expect(keys).not.toContain("ice-hound");
  });

  it("separa a Base do Construtor do progresso da vila principal", () => {
    expect(byKey("raged-barbarian")?.village).toBe("builderBase");
    expect(progressUnits(profile).map((u) => u.key)).not.toContain("raged-barbarian");
  });

  it("preserva achievements que revelam nível de construção", () => {
    expect(profile.achievements.find((a) => a.name === "Empire Builder")?.value).toBe(9);
  });
});

describe("playerDto", () => {
  it("aceita jogador sem clã, sem liga e sem heróis (conta nova)", () => {
    const parsed = playerDto.safeParse({
      tag: "#2PP",
      name: "Novato",
      townHallLevel: 2,
      expLevel: 3,
      trophies: 120,
      bestTrophies: 120,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const novice = mapPlayer(parsed.data);
    expect(novice.units).toHaveLength(0);
    expect(novice.clan).toBeUndefined();
    expect(novice.warStars).toBe(0);
  });

  it("rejeita payload sem townHallLevel", () => {
    expect(playerDto.safeParse({ tag: "#2PP", name: "X" }).success).toBe(false);
  });
});
