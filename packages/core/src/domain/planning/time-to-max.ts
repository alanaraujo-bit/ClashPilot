import {
  type Catalog,
  type Resource,
  type ScoreCategory,
  type TownHallLevel,
  type UnitState,
  countAtTownHall,
  entriesForTownHall,
  maxLevelForTownHall,
} from "@clashpilot/coc-data";
import { type UpgradeTrack, trackOf } from "./priority-engine.js";

/**
 * Quanto falta para a vila ficar máxima no Centro de Vila atual: upgrades, recurso e tempo.
 *
 * O tempo é dado **por trilha**, porque construtor, laboratório, herói e ferreiro correm em
 * paralelo. O tempo total da vila é o da trilha mais lenta, não a soma — somar tudo produziria
 * uma estimativa fantasiosa, que é o erro clássico das planilhas do gênero.
 */

export interface TrackRemaining {
  readonly track: UpgradeTrack;
  readonly upgrades: number;
  /** Tempo somado de todos os upgrades da trilha, em segundos (ainda sem dividir por operários). */
  readonly serialTimeSec: number;
  /** Tempo com os operários disponíveis trabalhando em paralelo. */
  readonly parallelTimeSec: number;
}

export interface RemainingWork {
  readonly upgrades: number;
  readonly costByResource: Readonly<Partial<Record<Resource, number>>>;
  readonly byTrack: readonly TrackRemaining[];
  readonly byCategory: Readonly<Partial<Record<ScoreCategory, number>>>;
  /** Tempo até a vila máxima: o da trilha mais lenta. */
  readonly criticalPathSec: number;
}

export interface RemainingInput {
  readonly catalog: Catalog;
  readonly townHallLevel: TownHallLevel;
  readonly units: readonly UnitState[];
  readonly knownCategories?: ReadonlySet<ScoreCategory>;
  /** Construtores disponíveis. Só a trilha `builder` paraleliza; lab e ferreiro são um só. */
  readonly builders: number;
  /**
   * Ocupação média observada dos construtores (0..1). O padrão de 1 é otimista de propósito:
   * quem chamar sem histórico recebe o cenário perfeito, e a UI deve dizer isso.
   */
  readonly builderOccupancy?: number;
}

function workersFor(track: UpgradeTrack, builders: number): number {
  // Herói: no jogo dá para subir mais de um herói ao mesmo tempo em TH altos, mas isso depende
  // de estado que não temos. Assumir 1 é a hipótese conservadora e verificável.
  return track === "builder" ? Math.max(1, builders) : 1;
}

export function computeRemainingWork(input: RemainingInput): RemainingWork {
  const { catalog, townHallLevel, units, knownCategories, builders } = input;
  const occupancy = Math.min(Math.max(input.builderOccupancy ?? 1, 0.05), 1);

  const levelsByKey = new Map<string, number[]>();
  for (const unit of units) {
    const list = levelsByKey.get(unit.key) ?? [];
    for (let i = 0; i < (unit.count ?? 1); i++) list.push(unit.level);
    levelsByKey.set(unit.key, list);
  }

  let upgrades = 0;
  const costByResource: Partial<Record<Resource, number>> = {};
  const byCategory: Partial<Record<ScoreCategory, number>> = {};
  const timeByTrack = new Map<UpgradeTrack, { upgrades: number; timeSec: number }>();

  for (const entry of entriesForTownHall(catalog, townHallLevel)) {
    if (knownCategories && !knownCategories.has(entry.scoreCategory)) continue;

    const cap = maxLevelForTownHall(entry, townHallLevel);
    const quantity = countAtTownHall(entry, townHallLevel);
    if (cap === 0 || quantity === 0) continue;

    const declared = levelsByKey.get(entry.key) ?? [];
    const current = [
      ...declared,
      ...Array.from({ length: Math.max(0, quantity - declared.length) }, () => 0),
    ].slice(0, quantity);

    const track = trackOf(entry);

    for (const level of current) {
      for (const spec of entry.levels) {
        if (spec.level <= level || spec.level > cap) continue;

        upgrades += 1;
        costByResource[spec.resource] = (costByResource[spec.resource] ?? 0) + spec.cost;
        byCategory[entry.scoreCategory] = (byCategory[entry.scoreCategory] ?? 0) + 1;

        const bucket = timeByTrack.get(track) ?? { upgrades: 0, timeSec: 0 };
        bucket.upgrades += 1;
        bucket.timeSec += spec.buildTimeSec;
        timeByTrack.set(track, bucket);
      }
    }
  }

  const byTrack: TrackRemaining[] = [...timeByTrack.entries()].map(([track, bucket]) => {
    const workers = workersFor(track, builders);
    const effective = track === "builder" ? workers * occupancy : occupancy;
    return {
      track,
      upgrades: bucket.upgrades,
      serialTimeSec: bucket.timeSec,
      parallelTimeSec: Math.round(bucket.timeSec / effective),
    };
  });

  return {
    upgrades,
    costByResource,
    byCategory,
    byTrack: byTrack.sort((a, b) => b.parallelTimeSec - a.parallelTimeSec),
    criticalPathSec: byTrack.reduce((max, t) => Math.max(max, t.parallelTimeSec), 0),
  };
}

/**
 * 950400 → "11 dias" · 5400 → "1h 30min" · 0 → "imediato".
 *
 * Zero segundos não é "concluído": equipamento de herói sobe na hora, limitado por minério e
 * não por espera. Chamar isso de concluído confundiria "não leva tempo" com "já está pronto".
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "imediato";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days >= 365) {
    const years = Math.floor(days / 365);
    const restDays = days % 365;
    return restDays > 0
      ? `${years} ano${years > 1 ? "s" : ""} e ${restDays} dias`
      : `${years} ano${years > 1 ? "s" : ""}`;
  }
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days} dia${days > 1 ? "s" : ""}`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  return `${minutes}min`;
}
