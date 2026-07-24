/**
 * Ferramenta de sanidade: lê uma vila real pelo gateway e imprime o progresso calculado.
 *
 *   pnpm --filter @clashpilot/gateway sanity "#2PP"
 *
 * Serve para responder a pergunta que teste unitário nenhum responde: "o número é plausível
 * para uma conta de verdade?". Um MAX% de 3% num TH8 ativo, por exemplo, seria sinal de que
 * a semântica de custo está deslocada.
 */
import { createHmac } from "node:crypto";
import { CATALOG, CATALOG_META, TOWN_HALLS } from "@clashpilot/coc-data";
import {
  API_KNOWN_CATEGORIES,
  computeMaxProgress,
  computeVillageScore,
  formatBp,
} from "@clashpilot/core";

const base = process.env["COC_GATEWAY_URL"] ?? "https://gateway-production-c67a.up.railway.app";
const secret = process.env["GATEWAY_SECRET"];
const tag = process.argv[2] ?? "#2PP";

if (!secret) {
  console.error("Defina GATEWAY_SECRET para assinar a requisição.");
  process.exit(1);
}

const path = `/players/${encodeURIComponent(tag)}`;
const timestamp = String(Date.now());
const signature = createHmac("sha256", secret).update(`${timestamp}.GET.${path}.`).digest("hex");

const res = await fetch(base + path, {
  headers: { "x-cp-timestamp": timestamp, "x-cp-signature": signature },
});
if (!res.ok) {
  console.error(`gateway respondeu ${res.status}: ${await res.text()}`);
  process.exit(1);
}

interface Unit {
  key: string;
  level: number;
  category: string;
  village: string;
  superTroopActive?: boolean;
}
const player = (await res.json()) as {
  name: string;
  tag: string;
  townHallLevel: number;
  units: Unit[];
};

const units = player.units
  .filter((u) => u.village === "home" && u.superTroopActive !== true)
  .map((u) => ({ key: u.key, level: u.level }));

const progress = computeMaxProgress({
  catalog: CATALOG,
  townHallLevel: player.townHallLevel,
  units,
  knownCategories: API_KNOWN_CATEGORIES,
});
const score = computeVillageScore({
  progress,
  priorityAdherence: null,
  activeDays: 7,
  windowDays: 14,
});

console.log(`\n${player.name} ${player.tag} · Centro de Vila ${player.townHallLevel}`);
console.log(
  `catálogo: ${CATALOG.length} itens · versão ${CATALOG_META.gameVersion} · ${TOWN_HALLS.length} CVs`,
);
console.log(`unidades lidas da API: ${units.length}\n`);
console.log(
  `PROGRESSO ATÉ A VILA MÁXIMA: ${formatBp(progress.totalBp)}  (confiável: ${progress.reliable})`,
);
console.log(`VILLAGE SCORE: ${score.score}/100`);
console.log(`COBERTURA DOS DADOS: ${formatBp(progress.coverageBp)} do peso da vila`);
console.log(`sem fonte de dados: ${progress.unknownCategories.join(", ") || "nenhuma"}\n`);

console.log("por categoria:");
for (const category of [...progress.byCategory].sort((a, b) => b.weight - a.weight)) {
  const label = category.category.padEnd(15);
  const pct = formatBp(category.progressBp).padStart(7);
  console.log(
    `  ${label} ${pct}   peso ${category.weight.toFixed(2)}   ${category.investedCost.toLocaleString("pt-BR")} / ${category.requiredCost.toLocaleString("pt-BR")}`,
  );
}

console.log("\nfatores do score:");
for (const factor of score.factors) {
  console.log(
    `  ${factor.label.padEnd(30)} ${String(factor.value).padStart(6)}  peso ${factor.weight.toFixed(2)}`,
  );
}
