import type { CatalogMeta } from "./types.js";
import { CATALOG } from "./catalog.js";

export * from "./types.js";
export * from "./townhall.js";
export * from "./catalog.js";
export * from "./classification.js";
export * from "./weights.js";

export const CATALOG_META: CatalogMeta = {
  gameVersion: "2026.1",
  updatedAt: "2026-07-24",
  completeness: CATALOG.length === 0 ? 0 : 1,
};

/** `true` quando o catálogo já tem custo/tempo reais e os números podem ser exibidos como fato. */
export const isCatalogComplete = (): boolean => CATALOG_META.completeness >= 1;
