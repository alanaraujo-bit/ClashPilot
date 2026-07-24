/** Diagnóstico: colunas e amostras dos arquivos de lógica do jogo. */
import path from "node:path";
import { type AssetName, loadAsset } from "./fetch-assets.js";
import { parseSupercellCsv } from "./csv.js";
import { GAME_FINGERPRINT } from "./fingerprint.js";

const cacheDir = path.join(import.meta.dirname, ".cache");
const [name, filter] = process.argv.slice(2) as [AssetName, string | undefined];

const raw = await loadAsset(GAME_FINGERPRINT, name, cacheDir);
const objects = parseSupercellCsv(raw);
const headers = raw
  .split(/\r?\n/)[0]!
  .split(",")
  .map((h) => h.replaceAll('"', ""));

console.log(`${name}: ${objects.length} objetos, ${headers.length} colunas\n`);

if (!filter) {
  console.log(headers.join("\n"));
} else {
  const cols = headers.filter((h) => new RegExp(filter, "i").test(h));
  console.log("colunas casadas:", cols.join(" | "), "\n");
  const sample = objects.find((o) => o.levels.length > 2) ?? objects[0];
  if (sample) {
    console.log(`amostra: ${sample.name} (${sample.levels.length} níveis)`);
    for (const level of sample.levels.slice(0, 3)) {
      console.log("  ", cols.map((c) => `${c}=${String(level[c] ?? "")}`).join("  "));
    }
  }
}
