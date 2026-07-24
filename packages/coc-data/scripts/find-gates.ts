/** Descobre como pets e equipamentos são destravados nos arquivos do jogo. */
import path from "node:path";
import { asBool, asInt, parseSupercellCsv } from "./csv.js";
import { loadAsset } from "./fetch-assets.js";
import { GAME_FINGERPRINT } from "./fingerprint.js";

const cache = path.join(import.meta.dirname, ".cache");

const buildings = parseSupercellCsv(await loadAsset(GAME_FINGERPRINT, "buildings", cache));
console.log("prédios com a flag Blacksmith:");
for (const b of buildings) {
  if (b.levels.some((row) => asBool(row["Blacksmith"]))) {
    console.log(`  ${b.name}: níveis ${b.levels.length}`);
    b.levels.slice(0, 6).forEach((row, i) => {
      console.log(`    nível ${i + 1} → TH ${String(asInt(row["TownHallLevel"]))}`);
    });
  }
}

const petsRaw = await loadAsset(GAME_FINGERPRINT, "pets", cache);
const petHeaders = petsRaw
  .split(/\r?\n/)[0]!
  .split(",")
  .map((h) => h.replaceAll('"', ""));
console.log(
  "\ncolunas de pets com cara de destravamento:",
  petHeaders.filter((h) => /unlock|require|house|building|shop|min/i.test(h)).join(" | ") ||
    "NENHUMA",
);

const pets = parseSupercellCsv(petsRaw);
console.log("pets:", pets.map((p) => p.name).join(", "));

console.log("\nprédios com 'Pet' no nome:");
for (const b of buildings) {
  if (/pet/i.test(b.name)) {
    console.log(`  ${b.name}: ${b.levels.length} níveis`);
    b.levels.forEach((row, i) =>
      console.log(`    nível ${i + 1} → TH ${String(asInt(row["TownHallLevel"]))}`),
    );
  }
}
