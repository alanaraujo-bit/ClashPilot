import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type CsvObject, type CsvRow, asInt, asString, parseSupercellCsv } from "./csv.js";
import { loadAsset } from "./fetch-assets.js";
import { GAME_FINGERPRINT } from "./fingerprint.js";

/**
 * Gera `src/generated/catalog.ts` a partir dos arquivos de lógica oficiais do jogo.
 *
 * ── Semântica dos custos (verificada contra o jogo e contra a API, não suposta) ──
 *
 * PRÉDIOS e HERÓIS: a linha N descreve o nível N e `BuildCost`/`UpgradeCost` é o custo para
 *   ATINGIR esse nível. Prova: Canhão linha 1 = 250 de ouro (o preço de construir um canhão) e
 *   Rei Bárbaro linha 1 = 5.000 de elixir negro (o preço do altar no TH7).
 *
 * TROPAS e FEITIÇOS: a linha N é o upgrade DO nível N PARA o N+1 — nível 1 é grátis. Prova:
 *   Bárbaro tem 12 linhas e a API devolve `maxLevel: 13` para ele.
 *
 * Confundir os dois deslocaria todos os custos em um nível. Os testes de integridade em
 * `catalog.generated.test.ts` travam esses valores.
 */

type Resource = "gold" | "elixir" | "darkElixir" | "gems" | "commonOre" | "rareOre" | "epicOre";
type ScoreCategory =
  "defense" | "wall" | "army" | "hero" | "pet" | "equipment" | "trap" | "infrastructure";

interface LevelSpec {
  level: number;
  cost: number;
  resource: Resource;
  buildTimeSec: number;
  minTownHall: number;
}

interface Entry {
  key: string;
  name: string;
  ptName: string;
  category: string;
  scoreCategory: ScoreCategory;
  village: "home" | "builderBase";
  usesBuilder: boolean;
  levels: LevelSpec[];
  countByTownHall?: Record<number, number>;
}

const cacheDir = path.join(import.meta.dirname, ".cache");
const outDir = path.join(import.meta.dirname, "..", "src", "generated");

const RESOURCES: Record<string, Resource> = {
  Gold: "gold",
  Elixir: "elixir",
  DarkElixir: "darkElixir",
  Diamonds: "gems",
  CommonOre: "commonOre",
  RareOre: "rareOre",
  EpicOre: "epicOre",
};

/**
 * Prédios que NÃO entram no catálogo de progresso:
 *  - altares de herói: o custo deles já é o nível 1 do herói em `heroes.csv` (contaria em dobro);
 *  - cenário de campanha single-player (`Npc`, `NonFunctional`) e prédios de goblin;
 *  - casa de construtor: comprada com gemas, não é alvo de upgrade.
 */
const EXCLUDED_CLASSES = new Set(["Npc", "NonFunctional"]);
const isHeroAltar = (name: string): boolean => name.startsWith("Hero Altar");

/** Prédios que não ocupam construtor: laboratório, ferreiro e casa de pets. */
const NON_BUILDER = new Set(["Laboratory", "Blacksmith", "Pet Shop"]);

const DEFENSE_CLASSES = new Set(["Defense"]);
const TRAP_CLASSES = new Set(["Trap"]);

function toKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function timeSeconds(row: CsvRow, prefix: string): number {
  const d = asInt(row[`${prefix}D`]) ?? 0;
  const h = asInt(row[`${prefix}H`]) ?? 0;
  const m = asInt(row[`${prefix}M`]) ?? 0;
  const s = asInt(row[`${prefix}S`]) ?? 0;
  return d * 86_400 + h * 3_600 + m * 60 + s;
}

function isHomeVillage(row: CsvRow): boolean {
  const village = asInt(row["VillageType"]);
  return village === null || village === 0;
}

function resourceOf(row: CsvRow, column: string): Resource | null {
  const raw = asString(row[column]);
  return raw ? (RESOURCES[raw] ?? null) : null;
}

// ─────────────────────────── Centros de Vila e contagens ───────────────────────────

const townHallObjects = parseSupercellCsv(await loadAsset(GAME_FINGERPRINT, "townHalls", cacheDir));

/** `countByTownHall[buildingName][thLevel] = quantidade liberada`. */
const countsByBuilding = new Map<string, Record<number, number>>();
townHallObjects.forEach((th, index) => {
  const level = index + 1;
  const row = th.levels[0];
  if (!row) return;
  for (const [column, value] of Object.entries(row)) {
    const count = asInt(value);
    if (count === null || count <= 0) continue;
    const existing = countsByBuilding.get(column) ?? {};
    existing[level] = count;
    countsByBuilding.set(column, existing);
  }
});

// ─────────────────────────────────── Prédios ───────────────────────────────────────

const buildingObjects = parseSupercellCsv(await loadAsset(GAME_FINGERPRINT, "buildings", cacheDir));
const unknownClasses = new Set<string>();

function buildingScoreCategory(name: string, buildingClass: string | null): ScoreCategory {
  if (name === "Wall") return "wall";
  if (buildingClass && DEFENSE_CLASSES.has(buildingClass)) return "defense";
  if (buildingClass && TRAP_CLASSES.has(buildingClass)) return "trap";
  if (buildingClass && !["Resource", "Town Hall", "Army", "Other"].includes(buildingClass)) {
    unknownClasses.add(buildingClass);
  }
  return "infrastructure";
}

function fromBuildings(objects: CsvObject[]): Entry[] {
  const entries: Entry[] = [];

  for (const object of objects) {
    const first = object.levels[0];
    if (!first || !isHomeVillage(first)) continue;
    if (isHeroAltar(object.name)) continue;

    const objectClass = asString(first["BuildingClass"]);
    if (objectClass && EXCLUDED_CLASSES.has(objectClass)) continue;

    const levels: LevelSpec[] = [];
    for (const row of object.levels) {
      const level = asInt(row["BuildingLevel"]);
      const cost = asInt(row["BuildCost"]);
      const resource = resourceOf(row, "BuildResource");
      const minTownHall = asInt(row["TownHallLevel"]);
      if (level === null || cost === null || resource === null || minTownHall === null) continue;
      // Gemas não são recurso de progresso: a casa de construtor não é alvo de upgrade.
      if (resource === "gems") continue;
      levels.push({
        level,
        cost,
        resource,
        buildTimeSec: timeSeconds(row, "BuildTime"),
        minTownHall,
      });
    }
    if (levels.length === 0) continue;

    const buildingClass = asString(first["BuildingClass"]);
    const counts = countsByBuilding.get(object.name);

    entries.push({
      key: toKey(object.name),
      name: object.name,
      ptName: object.name,
      category: object.name === "Wall" ? "wall" : buildingClass === "Trap" ? "trap" : "building",
      scoreCategory: buildingScoreCategory(object.name, buildingClass),
      village: "home",
      usesBuilder: !NON_BUILDER.has(object.name),
      levels,
      ...(counts ? { countByTownHall: counts } : {}),
    });
  }
  return entries;
}

// ───────────────────────────── Tropas, feitiços, heróis ────────────────────────────

/** Menor TH que libera cada nível de laboratório — as tropas são travadas por lab, não por TH. */
const labToTownHall = new Map<number, number>();
for (const object of buildingObjects) {
  if (object.name !== "Laboratory") continue;
  for (const row of object.levels) {
    const level = asInt(row["BuildingLevel"]);
    const th = asInt(row["TownHallLevel"]);
    if (level !== null && th !== null) labToTownHall.set(level, th);
  }
}

/** Tropas e feitiços: linha N = upgrade de N para N+1. O nível 1 é gratuito. */
function fromLabUpgrades(
  objects: CsvObject[],
  category: "troop" | "spell",
  scoreCategory: ScoreCategory,
): Entry[] {
  const entries: Entry[] = [];

  for (const object of objects) {
    const first = object.levels[0];
    if (!first || !isHomeVillage(first)) continue;
    if (asString(first["EnabledByCalendar"])) continue; // Super Tropa / evento: não é progresso

    const levels: LevelSpec[] = [];
    object.levels.forEach((row, index) => {
      const cost = asInt(row["UpgradeCost"]);
      const resource = resourceOf(row, "UpgradeResource");
      const labLevel = asInt(row["LaboratoryLevel"]);
      if (cost === null || resource === null) return;
      levels.push({
        level: index + 2,
        cost,
        resource,
        buildTimeSec: timeSeconds(row, "UpgradeTime"),
        minTownHall: (labLevel !== null ? labToTownHall.get(labLevel) : null) ?? 1,
      });
    });
    if (levels.length === 0) continue;

    // Nível 1 existe e é grátis — precisa entrar para o denominador do progresso fechar.
    const unlockTownHall = asInt(first["TownHallLevel"]) ?? levels[0]?.minTownHall ?? 1;
    levels.unshift({
      level: 1,
      cost: 0,
      resource: levels[0]?.resource ?? "elixir",
      buildTimeSec: 0,
      minTownHall: unlockTownHall,
    });

    entries.push({
      key: toKey(object.name),
      name: object.name,
      ptName: object.name,
      category,
      scoreCategory,
      village: "home",
      usesBuilder: false,
      levels,
    });
  }
  return entries;
}

/** Heróis, pets e equipamentos: linha N = o próprio nível N, e o custo é para ATINGI-LO. */
function fromDirectLevels(
  objects: CsvObject[],
  category: "hero" | "pet" | "equipment",
  scoreCategory: ScoreCategory,
  costColumn: string,
  resourceColumn: string,
  timePrefix: string,
  townHallColumn: string,
): Entry[] {
  const entries: Entry[] = [];

  for (const object of objects) {
    const first = object.levels[0];
    if (!first || !isHomeVillage(first)) continue;

    const levels: LevelSpec[] = [];
    object.levels.forEach((row, index) => {
      const cost = asInt(row[costColumn]);
      const resource = resourceOf(row, resourceColumn);
      if (cost === null || resource === null) return;
      levels.push({
        level: index + 1,
        cost,
        resource,
        buildTimeSec: timeSeconds(row, timePrefix),
        minTownHall: asInt(row[townHallColumn]) ?? 1,
      });
    });
    if (levels.length === 0) continue;

    entries.push({
      key: toKey(object.name),
      name: object.name,
      ptName: object.name,
      category,
      scoreCategory,
      village: "home",
      // Herói ocupa "slot de herói", não construtor; pet e equipamento também não.
      usesBuilder: false,
      levels,
    });
  }
  return entries;
}

/**
 * Equipamentos de herói: economia própria de minério, e um nível pode custar mais de um tipo
 * (`UpgradeResources = "CommonOre; RareOre"`, `UpgradeCosts = "240;20"`).
 *
 * Somamos as quantidades e rotulamos com o minério mais raro do nível. Somar minérios
 * diferentes só é legítimo porque numerador e denominador do progresso ficam DENTRO da
 * categoria "equipamento" — nunca comparamos minério com ouro.
 */
const ORE_RARITY: Resource[] = ["commonOre", "rareOre", "epicOre"];

function fromEquipment(objects: CsvObject[]): Entry[] {
  const entries: Entry[] = [];

  for (const object of objects) {
    const levels: LevelSpec[] = [];

    object.levels.forEach((row, index) => {
      const resourcesRaw = asString(row["UpgradeResources"]);
      const costsRaw = asString(row["UpgradeCosts"]);
      if (!resourcesRaw || !costsRaw) return;

      const resources = resourcesRaw.split(";").map((r) => RESOURCES[r.trim()]);
      const costs = costsRaw.split(";").map((c) => Number.parseInt(c.trim(), 10));
      const total = costs.reduce((acc, c) => acc + (Number.isFinite(c) ? c : 0), 0);
      if (total <= 0) return;

      const rarest = resources.reduce<Resource>((acc, r) => {
        if (!r) return acc;
        return ORE_RARITY.indexOf(r) > ORE_RARITY.indexOf(acc) ? r : acc;
      }, "commonOre");

      levels.push({
        level: index + 1,
        cost: total,
        resource: rarest,
        buildTimeSec: 0, // equipamento é instantâneo: gasta minério, não tempo
        minTownHall: 1,
      });
    });

    if (levels.length === 0) continue;

    entries.push({
      key: toKey(object.name),
      name: object.name,
      ptName: object.name,
      category: "equipment",
      scoreCategory: "equipment",
      village: "home",
      usesBuilder: false,
      levels,
    });
  }
  return entries;
}

/** Armadilhas vivem em `traps.csv`, com o mesmo formato dos prédios. */
function fromTraps(objects: CsvObject[]): Entry[] {
  const entries: Entry[] = [];

  for (const object of objects) {
    const first = object.levels[0];
    if (!first || !isHomeVillage(first)) continue;

    const levels: LevelSpec[] = [];
    object.levels.forEach((row, index) => {
      const cost = asInt(row["BuildCost"]);
      const resource = resourceOf(row, "BuildResource");
      const minTownHall = asInt(row["TownHallLevel"]);
      if (cost === null || resource === null || resource === "gems") return;
      levels.push({
        level: asInt(row["TrapLevel"]) ?? index + 1,
        cost,
        resource,
        buildTimeSec: timeSeconds(row, "BuildTime"),
        minTownHall: minTownHall ?? 1,
      });
    });
    if (levels.length === 0) continue;

    const counts = countsByBuilding.get(object.name);
    entries.push({
      key: toKey(object.name),
      name: object.name,
      ptName: object.name,
      category: "trap",
      scoreCategory: "trap",
      village: "home",
      usesBuilder: true,
      levels,
      ...(counts ? { countByTownHall: counts } : {}),
    });
  }
  return entries;
}

// ──────────────────────────────────── Montagem ─────────────────────────────────────

const [characters, spells, heroes, pets, equipment, traps] = await Promise.all([
  loadAsset(GAME_FINGERPRINT, "characters", cacheDir).then(parseSupercellCsv),
  loadAsset(GAME_FINGERPRINT, "spells", cacheDir).then(parseSupercellCsv),
  loadAsset(GAME_FINGERPRINT, "heroes", cacheDir).then(parseSupercellCsv),
  loadAsset(GAME_FINGERPRINT, "pets", cacheDir).then(parseSupercellCsv),
  loadAsset(GAME_FINGERPRINT, "equipment", cacheDir).then(parseSupercellCsv),
  loadAsset(GAME_FINGERPRINT, "traps", cacheDir).then(parseSupercellCsv),
]);

const catalog: Entry[] = [
  ...fromBuildings(buildingObjects),
  ...fromLabUpgrades(characters, "troop", "army"),
  ...fromLabUpgrades(spells, "spell", "army"),
  ...fromDirectLevels(
    heroes,
    "hero",
    "hero",
    "UpgradeCost",
    "UpgradeResource",
    "UpgradeTime",
    "RequiredTownHallLevel",
  ),
  ...fromDirectLevels(
    pets,
    "pet",
    "pet",
    "UpgradeCost",
    "UpgradeResource",
    "UpgradeTime",
    "RequiredTownHallLevel",
  ),
  ...fromEquipment(equipment),
  ...fromTraps(traps),
];

/**
 * Os arquivos do jogo trazem linhas reservadas (`unused1`, `unused2`, `disabled*`) que não
 * correspondem a nada jogável. Entram como itens de chave duplicada e sem nível — foi o teste
 * de unicidade de chave que as revelou.
 */
const PLACEHOLDER = /^(unused|disabled|deprecated|test|dummy)/i;
const cleaned = catalog.filter(
  (entry) => !PLACEHOLDER.test(entry.name) && entry.key.length > 0 && entry.levels.length > 0,
);
const removed = catalog.filter((entry) => !cleaned.includes(entry));
if (removed.length > 0) {
  console.log(
    `  descartados ${removed.length}:`,
    removed.map((r) => `${r.name || "(sem nome)"}[${r.scoreCategory}]`).join(", "),
  );
}
catalog.length = 0;
catalog.push(...cleaned);

catalog.sort((a, b) => a.key.localeCompare(b.key));

const byCategory = catalog.reduce<Record<string, number>>((acc, entry) => {
  acc[entry.scoreCategory] = (acc[entry.scoreCategory] ?? 0) + 1;
  return acc;
}, {});

/**
 * Tabela de Centros de Vila derivada dos próprios dados — substitui a tabela escrita à mão
 * da Fase 0, que estava marcada como `verified: false` justamente por ser de memória.
 */
const wallEntry = catalog.find((e) => e.key === "wall");
const labEntry = catalog.find((e) => e.key === "laboratory");
const townHallCount = townHallObjects.length;

const maxLevelAt = (entry: Entry | undefined, th: number): number =>
  entry
    ? entry.levels.reduce((max, l) => (l.minTownHall <= th && l.level > max ? l.level : max), 0)
    : 0;

const townHalls = Array.from({ length: townHallCount }, (_, index) => {
  const level = index + 1;
  const labLevel = maxLevelAt(labEntry, level);
  return {
    level,
    labLevel: labLevel > 0 ? labLevel : null,
    wallCount: wallEntry?.countByTownHall?.[level] ?? 0,
    wallMaxLevel: maxLevelAt(wallEntry, level),
    verified: true,
  };
});

const header = `// GERADO AUTOMATICAMENTE — não editar à mão.
// Fonte: arquivos de lógica oficiais do Clash of Clans.
// Regenerar: pnpm --filter @clashpilot/coc-data build:catalog
// Fingerprint dos assets: ${GAME_FINGERPRINT}
// Gerado em: ${new Date().toISOString()}

import type { CatalogEntry, TownHallSpec } from "../types.js";

export const GENERATED_FINGERPRINT = ${JSON.stringify(GAME_FINGERPRINT)};
export const GENERATED_AT = ${JSON.stringify(new Date().toISOString())};

export const GENERATED_TOWN_HALLS: readonly TownHallSpec[] = ${JSON.stringify(townHalls, null, 2)};

export const GENERATED_CATALOG: readonly CatalogEntry[] = ${JSON.stringify(catalog, null, 2)};
`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "catalog.ts"), header, "utf8");

console.log(`✔ catálogo gerado: ${catalog.length} itens`);
console.log(
  "  por categoria:",
  Object.entries(byCategory)
    .map(([k, v]) => `${k}=${v}`)
    .join(" "),
);
console.log(`  níveis totais: ${catalog.reduce((acc, e) => acc + e.levels.length, 0)}`);
if (unknownClasses.size > 0) {
  console.log("  ⚠ BuildingClass não mapeadas:", [...unknownClasses].join(", "));
}
