import {
  CATEGORY_WEIGHTS,
  type Catalog,
  type CatalogEntry,
  type ScoreCategory,
  type TownHallLevel,
  type UnitState,
  countAtTownHall,
  entriesForTownHall,
  maxLevelForTownHall,
} from "@clashpilot/coc-data";

/**
 * Motor de prioridades.
 *
 * A pergunta é "qual upgrade rende mais". A resposta precisa de uma unidade honesta, e ela
 * já existe: **quanto de progresso até a vila máxima este upgrade entrega, por dia de espera**.
 *
 *     ROI = ganho em basis points de progresso ÷ dias de construção
 *
 * Tudo aí vem do catálogo oficial e do estado real da vila — nenhum peso inventado, nenhuma
 * tabela de "meta" chutada. Se um dia entrarem multiplicadores de meta, entram como ADR
 * próprio e com fonte, não como número mágico no meio do código.
 *
 * ── Por que os candidatos são separados em trilhas ──
 * Construtor, laboratório, herói e ferreiro correm **em paralelo** no jogo. Comparar um
 * upgrade de laboratório com um de defesa pelo mesmo ROI sugeriria escolher entre eles —
 * quando na verdade os dois podem (e devem) rodar ao mesmo tempo. Cada trilha tem sua fila.
 */

export type UpgradeTrack = "builder" | "lab" | "hero" | "forge";

export interface UpgradeCandidate {
  readonly key: string;
  readonly name: string;
  readonly category: ScoreCategory;
  readonly track: UpgradeTrack;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly costAmount: number;
  readonly costResource: string;
  readonly timeSec: number;
  /** Progresso até a vila máxima que este upgrade entrega, em basis points. */
  readonly progressGainBp: number;
  /** Basis points de progresso por dia de espera. `null` quando o upgrade é instantâneo. */
  readonly roiPerDay: number | null;
}

export interface PriorityInput {
  readonly catalog: Catalog;
  readonly townHallLevel: TownHallLevel;
  readonly units: readonly UnitState[];
  /** Categorias com fonte de dados — as demais não geram candidato (ADR-015). */
  readonly knownCategories?: ReadonlySet<ScoreCategory>;
}

const BP = 10_000;
const SECONDS_PER_DAY = 86_400;

export function trackOf(entry: CatalogEntry): UpgradeTrack {
  if (entry.scoreCategory === "army") return "lab";
  if (entry.scoreCategory === "hero" || entry.scoreCategory === "pet") return "hero";
  if (entry.scoreCategory === "equipment") return "forge";
  return "builder";
}

/** Níveis atuais por chave. Cada elemento é uma cópia (um canhão, uma peça de muralha). */
function instancesByKey(units: readonly UnitState[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const unit of units) {
    const list = map.get(unit.key) ?? [];
    for (let i = 0; i < (unit.count ?? 1); i++) list.push(unit.level);
    map.set(unit.key, list);
  }
  for (const list of map.values()) list.sort((a, b) => a - b);
  return map;
}

/**
 * Custo total exigido por categoria para a vila ficar máxima no TH atual — o denominador que
 * transforma "custo deste upgrade" em "quanto do progresso ele fecha".
 */
function requiredByCategory(
  catalog: Catalog,
  townHallLevel: TownHallLevel,
): Map<ScoreCategory, number> {
  const required = new Map<ScoreCategory, number>();

  for (const entry of entriesForTownHall(catalog, townHallLevel)) {
    const cap = maxLevelForTownHall(entry, townHallLevel);
    const quantity = countAtTownHall(entry, townHallLevel);
    if (cap === 0 || quantity === 0) continue;

    const capCost = entry.levels
      .filter((level) => level.level <= cap)
      .reduce((acc, level) => acc + level.cost, 0);

    required.set(
      entry.scoreCategory,
      (required.get(entry.scoreCategory) ?? 0) + capCost * quantity,
    );
  }
  return required;
}

export function rankUpgrades(input: PriorityInput): UpgradeCandidate[] {
  const { catalog, townHallLevel, units, knownCategories } = input;

  const instances = instancesByKey(units);
  const required = requiredByCategory(catalog, townHallLevel);

  // Peso renormalizado sobre as categorias que existem E são conhecidas — mesma regra do
  // progresso, para que a soma dos ganhos de todos os candidatos feche exatamente o que falta.
  let knownWeight = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS) as [ScoreCategory, number][]) {
    if ((required.get(category) ?? 0) <= 0) continue;
    if (knownCategories && !knownCategories.has(category)) continue;
    knownWeight += weight;
  }
  if (knownWeight <= 0) return [];

  const candidates: UpgradeCandidate[] = [];

  for (const entry of entriesForTownHall(catalog, townHallLevel)) {
    if (knownCategories && !knownCategories.has(entry.scoreCategory)) continue;

    const cap = maxLevelForTownHall(entry, townHallLevel);
    const quantity = countAtTownHall(entry, townHallLevel);
    const categoryRequired = required.get(entry.scoreCategory) ?? 0;
    if (cap === 0 || quantity === 0 || categoryRequired <= 0) continue;

    const current = instances.get(entry.key) ?? [];
    // Cópias não declaradas contam como nível 0 — o mesmo tratamento do cálculo de progresso.
    const levels = [
      ...current,
      ...Array.from({ length: Math.max(0, quantity - current.length) }, () => 0),
    ]
      .slice(0, quantity)
      .sort((a, b) => a - b);

    // Só a cópia mais atrasada vira candidato: sugerir sete canhões idênticos é ruído.
    const lowest = levels[0];
    if (lowest === undefined || lowest >= cap) continue;

    const next = entry.levels.find((level) => level.level === lowest + 1);
    if (!next) continue;

    const weight = CATEGORY_WEIGHTS[entry.scoreCategory];
    const progressGainBp = (next.cost / categoryRequired) * (weight / knownWeight) * BP;
    const timeSec = next.buildTimeSec;

    candidates.push({
      key: entry.key,
      // `ptName` é o nome de exibição (pt-BR oficial quando temos, senão o EN público).
      name: entry.ptName,
      category: entry.scoreCategory,
      track: trackOf(entry),
      fromLevel: lowest,
      toLevel: next.level,
      costAmount: next.cost,
      costResource: next.resource,
      timeSec,
      progressGainBp,
      roiPerDay: timeSec > 0 ? progressGainBp / (timeSec / SECONDS_PER_DAY) : null,
    });
  }

  return candidates.sort((a, b) => {
    // Instantâneos (equipamento) não têm ROI por tempo: ordena pelo ganho puro, no fim.
    if (a.roiPerDay === null && b.roiPerDay === null) return b.progressGainBp - a.progressGainBp;
    if (a.roiPerDay === null) return 1;
    if (b.roiPerDay === null) return -1;
    return b.roiPerDay - a.roiPerDay;
  });
}

/** Melhores candidatos de cada trilha — as filas que correm em paralelo no jogo. */
export function rankByTrack(
  input: PriorityInput,
  perTrack = 3,
): Record<UpgradeTrack, UpgradeCandidate[]> {
  const all = rankUpgrades(input);
  const result: Record<UpgradeTrack, UpgradeCandidate[]> = {
    builder: [],
    lab: [],
    hero: [],
    forge: [],
  };
  for (const candidate of all) {
    if (result[candidate.track].length < perTrack) result[candidate.track].push(candidate);
  }
  return result;
}
