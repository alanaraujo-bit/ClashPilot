import { CATALOG } from "@clashpilot/coc-data";
import { formatBp } from "@clashpilot/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buildLedgerView } from "@/server/ledger";
import { getPrimaryPlayer } from "@/server/session";
import { LedgerCategory, type SlotView } from "./ledger-category";

export const metadata: Metadata = { title: "Registro da vila" };

const CATEGORY_LABELS: Record<string, string> = {
  defense: "Defesas",
  wall: "Muralhas",
  trap: "Armadilhas",
  infrastructure: "Recursos e exército",
};

const ORDER = ["defense", "infrastructure", "wall", "trap"];

const breakdownSchema = z
  .object({ coverageBp: z.number().nullable().default(null) })
  .catch({ coverageBp: null });

/** Nível máximo de cada item no Centro de Vila ANTERIOR — base da heurística de um toque. */
function previousTownHallMax(townHallLevel: number): Record<string, number> {
  const previous = Math.max(1, townHallLevel - 1);
  const result: Record<string, number> = {};
  for (const entry of CATALOG) {
    const max = entry.levels.reduce(
      (acc, level) => (level.minTownHall <= previous && level.level > acc ? level.level : acc),
      0,
    );
    if (max > 0) result[entry.key] = max;
  }
  return result;
}

export default async function VillageLedgerPage() {
  const player = await getPrimaryPlayer();
  if (!player) redirect("/link-player");
  if (!player.current) redirect("/dashboard");

  const townHallLevel = player.current.townHallLevel;
  const slots = await buildLedgerView(player.id, townHallLevel);
  const coverage = breakdownSchema.parse(player.current.scoreBreakdown).coverageBp;
  const previousMax = previousTownHallMax(townHallLevel);

  const byCategory = ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    slots: slots.filter((slot) => slot.category === category) as SlotView[],
  })).filter((group) => group.slots.length > 0);

  return (
    <div className="flex flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Registro da vila</h1>
        <p className="max-w-2xl text-[13px]" style={{ color: "var(--text-secondary)" }}>
          A API oficial do Clash of Clans informa tropas, heróis, pets e equipamentos — mas não diz
          nada sobre construções. Preencha uma vez e o progresso passa a valer pela vila inteira.
          Use os atalhos: a maioria das contas resolve em um toque.
        </p>
        {coverage !== null ? (
          <p className="text-[13px]">
            Cobertura atual: <strong className="tabular">{formatBp(coverage)}</strong> do peso da
            vila ·{" "}
            <Link href="/dashboard" className="underline underline-offset-4">
              ver dashboard
            </Link>
          </p>
        ) : null}
      </header>

      {!player.verified ? (
        <p
          className="rounded-[var(--radius-card)] border p-4 text-[13px]"
          style={{ borderColor: "var(--warning)", color: "var(--text-secondary)" }}
        >
          Esta vila está em modo observação. O registro só é gravado para contas verificadas —
          vincule novamente usando o token da API do jogo para liberar.
        </p>
      ) : null}

      {byCategory.map((group) => (
        <section key={group.category}>
          <LedgerCategory
            playerId={player.id}
            category={group.category}
            label={group.label}
            slots={group.slots}
            previousTownHallMax={previousMax}
          />
        </section>
      ))}

      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {slots.length} tipos de construção no Centro de Vila {townHallLevel}, segundo os arquivos
        oficiais do jogo. Item que você ainda não construiu: deixe em 0.
      </p>
    </div>
  );
}
