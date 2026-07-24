/**
 * Tipos do catálogo estático do jogo.
 *
 * Este pacote é a ÚNICA fonte de verdade para custo, tempo e nível máximo por Centro de Vila.
 * A API oficial NÃO fornece nada disso — ver docs/00-visao-e-escopo.md §2.3 e ADR-004.
 */

export type Village = "home" | "builderBase";

export type Resource = "gold" | "elixir" | "darkElixir" | "gems";

export type UnitCategory =
  "troop" | "spell" | "hero" | "pet" | "equipment" | "siege" | "building" | "wall" | "trap";

/** Categorias agregadas usadas pelo cálculo de progresso e pelo Village Score. */
export type ScoreCategory =
  | "defense"
  | "wall"
  | "army" // tropas + feitiços (laboratório)
  | "hero"
  | "pet"
  | "equipment"
  | "trap"
  | "infrastructure"; // acampamentos, armazéns, coletores, castelo, quartéis

/** Nível do Centro de Vila. 1..17 na versão atual do jogo. */
export type TownHallLevel = number;

export interface LevelSpec {
  readonly level: number;
  /** Custo para SUBIR do nível anterior até este. Nível 1 = custo de construção inicial. */
  readonly cost: number;
  readonly resource: Resource;
  /** Tempo de construção/pesquisa em segundos. */
  readonly buildTimeSec: number;
  /** Menor Centro de Vila em que este nível é liberado. */
  readonly minTownHall: TownHallLevel;
}

export interface CatalogEntry {
  readonly key: string;
  readonly name: string;
  /** Nome em pt-BR para exibição. */
  readonly ptName: string;
  readonly category: UnitCategory;
  readonly scoreCategory: ScoreCategory;
  readonly village: Village;
  /** Se o upgrade ocupa construtor (false para laboratório, ferreiro e casa de pets). */
  readonly usesBuilder: boolean;
  readonly levels: readonly LevelSpec[];
  /**
   * Quantidade disponível por Centro de Vila. Chave = nível do TH.
   * Ausente ⇒ 1 unidade a partir do `minTownHall` do primeiro nível.
   */
  readonly countByTownHall?: Readonly<Record<number, number>>;
}

export interface TownHallSpec {
  readonly level: TownHallLevel;
  /** Nível máximo do Laboratório liberado. `null` antes do TH3. */
  readonly labLevel: number | null;
  readonly wallCount: number;
  readonly wallMaxLevel: number;
  /**
   * `true` quando os números já foram conferidos contra a fonte curada (Fase 3).
   * A UI marca como estimativa tudo que vier de um TH não verificado.
   */
  readonly verified: boolean;
}

/**
 * Construtores NÃO dependem do Centro de Vila — são comprados com gemas (até 5) mais o
 * B.O.B./O.T.T.O. Por isso vivem no Village Ledger do jogador, não neste catálogo.
 */
export const BUILDERS_MIN = 1;
export const BUILDERS_MAX = 6;
export const BUILDERS_DEFAULT = 5;

/** Estado de um item na vila do jogador, já normalizado (API ou ledger). */
export interface UnitState {
  readonly key: string;
  readonly level: number;
  /** Para muralhas: quantas peças estão neste nível. Padrão 1. */
  readonly count?: number;
}

export interface CatalogMeta {
  readonly gameVersion: string;
  readonly updatedAt: string;
  /**
   * Fração do catálogo já preenchida com custo/tempo reais (0..1).
   * Enquanto < 1, os cálculos de custo em recurso são marcados como estimativa na UI.
   */
  readonly completeness: number;
}
