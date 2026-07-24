import {
  CATEGORY_WEIGHTS,
  type Catalog,
  type ScoreCategory,
  type TownHallLevel,
  type UnitState,
  countAtTownHall,
  cumulativeCost,
  entriesForTownHall,
  maxLevelForTownHall,
} from "@clashpilot/coc-data";

/**
 * Progresso até a vila máxima, ponderado por CUSTO ACUMULADO — não por nível (ADR-006).
 *
 * Contar níveis trata "Canhão 1→2" como equivalente a "Rei 79→80", o que produz um número
 * bonito e inútil. O custo acumulado é a melhor aproximação do recurso realmente escasso:
 * tempo de construtor + recurso.
 */

export interface CategoryProgress {
  readonly category: ScoreCategory;
  /** Basis points: 7240 = 72,40%. */
  readonly progressBp: number;
  readonly investedCost: number;
  readonly requiredCost: number;
  readonly weight: number;
}

export interface MaxProgressResult {
  /** Progresso geral em basis points (0..10000), calculado SÓ sobre categorias conhecidas. */
  readonly totalBp: number;
  readonly byCategory: readonly CategoryProgress[];
  /** Categorias que existem no TH atual mas para as quais não temos fonte de dados. */
  readonly unknownCategories: readonly ScoreCategory[];
  /**
   * Fatia do peso total que temos como conhecida, em basis points. 10000 = vila inteira
   * coberta; 3300 = só um terço do peso tem dado, e o número geral vale pouco sozinho.
   */
  readonly coverageBp: number;
  /**
   * `false` quando nenhuma categoria conhecida tinha custo — catálogo vazio ou sem dados.
   * A UI não deve exibir o número como fato nesse caso.
   */
  readonly reliable: boolean;
}

export interface MaxProgressInput {
  readonly catalog: Catalog;
  readonly townHallLevel: TownHallLevel;
  /** Estado da vila. Itens ausentes contam como nível 0 — ausência ≠ inexistente. */
  readonly units: readonly UnitState[];
  /**
   * Categorias para as quais existe fonte de dados confiável.
   *
   * Sem isto, defesas e muralhas entrariam no denominador com numerador zero e o app
   * anunciaria "vila 1,6% completa" para um TH8 — quando a verdade é "só conhecemos o
   * exército". Distinguir *não construído* de *não sabemos* é o núcleo do ADR-003.
   *
   * Omitir = considerar tudo conhecido (usado nos testes e quando o Village Ledger está
   * completo).
   */
  readonly knownCategories?: ReadonlySet<ScoreCategory>;
}

/** O que a API oficial entrega sozinha, sem o Village Ledger (docs/00 §2.1). */
export const API_KNOWN_CATEGORIES: ReadonlySet<ScoreCategory> = new Set([
  "army",
  "hero",
  "pet",
  "equipment",
]);

const BP = 10_000;

/** Soma as quantidades declaradas por chave. Muralhas usam `count` para agrupar por nível. */
function investedByKey(units: readonly UnitState[]): Map<string, UnitState[]> {
  const map = new Map<string, UnitState[]>();
  for (const unit of units) {
    const list = map.get(unit.key);
    if (list) list.push(unit);
    else map.set(unit.key, [unit]);
  }
  return map;
}

export function computeMaxProgress(input: MaxProgressInput): MaxProgressResult {
  const { catalog, townHallLevel, units } = input;
  const states = investedByKey(units);

  const invested = new Map<ScoreCategory, number>();
  const required = new Map<ScoreCategory, number>();

  for (const entry of entriesForTownHall(catalog, townHallLevel)) {
    const cap = maxLevelForTownHall(entry, townHallLevel);
    const quantity = countAtTownHall(entry, townHallLevel);
    if (cap === 0 || quantity === 0) continue;

    const capCost = cumulativeCost(entry, cap);
    required.set(
      entry.scoreCategory,
      (required.get(entry.scoreCategory) ?? 0) + capCost * quantity,
    );

    // Instâncias não declaradas contam como nível 0 (custo 0) e só ocupam o denominador.
    let owned = 0;
    for (const state of states.get(entry.key) ?? []) {
      // Um nível acima do teto do TH atual não gera crédito extra: o teto é o denominador.
      owned += cumulativeCost(entry, Math.min(state.level, cap)) * (state.count ?? 1);
    }

    invested.set(entry.scoreCategory, (invested.get(entry.scoreCategory) ?? 0) + owned);
  }

  const known: CategoryProgress[] = [];
  const unknownCategories: ScoreCategory[] = [];
  let knownWeight = 0;
  let existingWeight = 0;

  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS) as [ScoreCategory, number][]) {
    const req = required.get(category) ?? 0;
    // Categoria que nem existe neste TH sai da conta inteira: uma vila TH2 não tem heróis,
    // e o peso de herói não pode virar 20% de progresso perdido para sempre.
    if (req <= 0) continue;
    existingWeight += weight;

    if (input.knownCategories && !input.knownCategories.has(category)) {
      unknownCategories.push(category);
      continue;
    }

    const inv = invested.get(category) ?? 0;
    knownWeight += weight;
    known.push({
      category,
      progressBp: Math.round(Math.min(inv / req, 1) * BP),
      investedCost: inv,
      requiredCost: req,
      weight,
    });
  }

  if (known.length === 0) {
    return { totalBp: 0, byCategory: [], unknownCategories, coverageBp: 0, reliable: false };
  }

  const totalBp = Math.round(
    known.reduce((acc, c) => acc + (c.weight / knownWeight) * c.progressBp, 0),
  );

  return {
    totalBp,
    byCategory: known,
    unknownCategories,
    coverageBp: existingWeight > 0 ? Math.round((knownWeight / existingWeight) * BP) : 0,
    reliable: true,
  };
}

/** 7240 → "72,4%" */
export function formatBp(bp: number, locale = "pt-BR", fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(bp / BP);
}
