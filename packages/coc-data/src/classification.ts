import type { ScoreCategory, UnitCategory } from "./types.js";

/**
 * A API devolve pets e máquinas de cerco DENTRO do array `troops`. Separar por lista de nomes
 * conhecidos é a única forma correta — não existe campo que distinga.
 *
 * Degradação: um nome novo (pet de um update recente) cai em "troop". Isso subestima
 * levemente a categoria de pets em vez de quebrar o parsing, que é o comportamento desejado.
 * A lista é revisada a cada balance update junto com o catálogo (ADR-004).
 */

export const PET_NAMES: ReadonlySet<string> = new Set([
  "L.A.S.S.I",
  "Electro Owl",
  "Mighty Yak",
  "Unicorn",
  "Frosty",
  "Diggy",
  "Poison Lizard",
  "Phoenix",
  "Spirit Fox",
  "Angry Jelly",
  "Sneezy",
]);

export const SIEGE_NAMES: ReadonlySet<string> = new Set([
  "Wall Wrecker",
  "Battle Blimp",
  "Stone Slammer",
  "Siege Barracks",
  "Log Launcher",
  "Flame Flinger",
  "Battle Drill",
  "Troop Launcher",
]);

/** Classifica um item vindo do array `troops` da API. */
export function classifyTroop(name: string): UnitCategory {
  if (PET_NAMES.has(name)) return "pet";
  if (SIEGE_NAMES.has(name)) return "siege";
  return "troop";
}

const CATEGORY_TO_SCORE: Readonly<Record<UnitCategory, ScoreCategory>> = {
  troop: "army",
  spell: "army",
  siege: "army",
  hero: "hero",
  pet: "pet",
  equipment: "equipment",
  building: "infrastructure",
  wall: "wall",
  trap: "trap",
};

export function toScoreCategory(category: UnitCategory): ScoreCategory {
  return CATEGORY_TO_SCORE[category];
}

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Chave estável e segura para URL a partir do nome do jogo. */
export function toKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
