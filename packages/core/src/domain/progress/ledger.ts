import {
  type Catalog,
  type ScoreCategory,
  type TownHallLevel,
  type UnitState,
  countAtTownHall,
  entriesForTownHall,
} from "@clashpilot/coc-data";

/**
 * Village Ledger — a camada B do ADR-003.
 *
 * A API oficial não expõe defesas, muralhas, armadilhas nem infraestrutura. Estas quatro
 * categorias só existem porque o jogador declara, e é isso que leva a cobertura do progresso
 * de ~53% para 100%.
 */

/** Categorias que só o jogador pode informar. */
export const LEDGER_CATEGORIES: ReadonlySet<ScoreCategory> = new Set([
  "defense",
  "wall",
  "trap",
  "infrastructure",
]);

export interface LedgerRow {
  readonly buildingKey: string;
  readonly slot: number;
  readonly level: number;
  /** Usado só por muralha: quantas peças estão neste nível. */
  readonly count: number;
}

/** Um prédio que o jogador precisa declarar, com quantas cópias existem no TH atual. */
export interface LedgerSlot {
  readonly key: string;
  readonly name: string;
  readonly category: ScoreCategory;
  readonly quantity: number;
  readonly maxLevel: number;
}

/**
 * Monta o formulário do ledger para um Centro de Vila: todo item que existe naquele TH,
 * quantas cópias e até que nível pode ir.
 */
export function ledgerSlotsForTownHall(catalog: Catalog, townHall: TownHallLevel): LedgerSlot[] {
  const slots: LedgerSlot[] = [];

  for (const entry of entriesForTownHall(catalog, townHall)) {
    if (!LEDGER_CATEGORIES.has(entry.scoreCategory)) continue;

    const quantity = countAtTownHall(entry, townHall);
    if (quantity <= 0) continue;

    const maxLevel = entry.levels.reduce(
      (max, level) => (level.minTownHall <= townHall && level.level > max ? level.level : max),
      0,
    );
    if (maxLevel <= 0) continue;

    slots.push({
      key: entry.key,
      name: entry.name,
      category: entry.scoreCategory,
      quantity,
      maxLevel,
    });
  }

  return slots.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** Converte as linhas do ledger em `UnitState[]`, no mesmo formato que vem da API. */
export function ledgerToUnits(rows: readonly LedgerRow[]): UnitState[] {
  return rows
    .filter((row) => row.level > 0 && row.count > 0)
    .map((row) => ({ key: row.buildingKey, level: row.level, count: row.count }));
}

/**
 * Categorias com fonte de dados, considerando o que a API entrega e o que o ledger já cobre.
 *
 * Uma categoria do ledger só conta como conhecida quando o jogador declarou alguma coisa
 * nela — declarar é um ato explícito por categoria (o formulário salva a categoria inteira),
 * então "não declarado" nunca é confundido com "não construído".
 */
export function knownCategoriesFrom(
  apiCategories: ReadonlySet<ScoreCategory>,
  declared: readonly ScoreCategory[],
): ReadonlySet<ScoreCategory> {
  return new Set([...apiCategories, ...declared]);
}
