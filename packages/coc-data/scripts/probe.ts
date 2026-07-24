/** Sonda um objeto específico e imprime todos os níveis das colunas pedidas. */
import path from "node:path";
import { type AssetName, loadAsset } from "./fetch-assets.js";
import { parseSupercellCsv } from "./csv.js";
import { GAME_FINGERPRINT } from "./fingerprint.js";

const cacheDir = path.join(import.meta.dirname, ".cache");
const [asset, objectName, ...cols] = process.argv.slice(2) as [AssetName, string, ...string[]];

const objects = parseSupercellCsv(await loadAsset(GAME_FINGERPRINT, asset, cacheDir));
const target = objects.find((o) => o.name === objectName);

if (!target) {
  console.log(`"${objectName}" não encontrado. Alguns nomes:`);
  console.log(
    objects
      .slice(0, 30)
      .map((o) => o.name)
      .join(", "),
  );
} else {
  console.log(`${target.name}: ${target.levels.length} linhas`);
  target.levels.forEach((level, i) => {
    console.log(
      `  linha ${i + 1}: ` + cols.map((c) => `${c}=${String(level[c] ?? "")}`).join("  "),
    );
  });
}
