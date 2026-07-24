import { CATALOG } from "@clashpilot/coc-data";
import { unitSchema } from "@clashpilot/contracts";
import {
  API_KNOWN_CATEGORIES,
  type UpgradeCandidate,
  computeRemainingWork,
  formatBp,
  formatDuration,
  knownCategoriesFrom,
  ledgerToUnits,
  rankByTrack,
} from "@clashpilot/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatNumber } from "@/lib/utils";
import { declaredCategories, loadLedger } from "@/server/ledger";
import { getPrimaryPlayer } from "@/server/session";

export const metadata: Metadata = { title: "Plano de evolução" };

const unitsSchema = z.array(unitSchema).catch([]);

const TRACK_LABELS: Record<string, { title: string; hint: string }> = {
  builder: { title: "Construtor", hint: "Ocupa um construtor" },
  lab: { title: "Laboratório", hint: "Uma pesquisa por vez" },
  hero: { title: "Heróis e pets", hint: "O herói fica fora da vila durante o upgrade" },
  forge: { title: "Ferraria", hint: "Instantâneo — limitado por minério, não por tempo" },
};

const RESOURCE_LABELS: Record<string, string> = {
  gold: "ouro",
  elixir: "elixir",
  darkElixir: "elixir negro",
  commonOre: "minério comum",
  rareOre: "minério raro",
  epicOre: "minério épico",
};

export default async function PlanPage() {
  const player = await getPrimaryPlayer();
  if (!player) redirect("/link-player");
  if (!player.current) redirect("/dashboard");

  const current = player.current;
  const apiUnits = unitsSchema
    .parse(current.units)
    .filter((u) => u.village === "home" && u.superTroopActive !== true)
    .map((u) =>
      u.count === undefined
        ? { key: u.key, level: u.level }
        : { key: u.key, level: u.level, count: u.count },
    );

  const ledger = await loadLedger(player.id);
  const units = [...apiUnits, ...ledgerToUnits(ledger)];
  const knownCategories = knownCategoriesFrom(API_KNOWN_CATEGORIES, declaredCategories(ledger));

  const input = {
    catalog: CATALOG,
    townHallLevel: current.townHallLevel,
    units,
    knownCategories,
  };

  const tracks = rankByTrack(input, 5);
  const remaining = computeRemainingWork({ ...input, builders: player.builders });
  const hasSuggestions = Object.values(tracks).some((list) => list.length > 0);

  return (
    <div className="flex flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Plano de evolução</h1>
        <p className="max-w-2xl text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Ordenado por retorno: quanto de progresso até a vila máxima cada upgrade entrega por dia
          de espera. As filas correm em paralelo no jogo — você pode tocar uma de cada coluna ao
          mesmo tempo.
        </p>
      </header>

      {!hasSuggestions ? (
        <p className="card p-5 text-[14px]">
          Nada a sugerir: tudo que conhecemos já está no máximo do Centro de Vila{" "}
          {current.townHallLevel}.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(TRACK_LABELS) as (keyof typeof tracks)[]).map((track) => {
            const list = tracks[track];
            if (list.length === 0) return null;
            return (
              <section key={track} className="card flex flex-col gap-3 p-5">
                <header>
                  <h2 className="text-[15px] font-medium tracking-tight">
                    {TRACK_LABELS[track]?.title}
                  </h2>
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {TRACK_LABELS[track]?.hint}
                  </p>
                </header>
                <ol className="flex flex-col gap-3">
                  {list.map((candidate, index) => (
                    <CandidateRow key={candidate.key} candidate={candidate} position={index + 1} />
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      <section className="card flex flex-col gap-4 p-5">
        <header>
          <h2 className="text-[15px] font-medium tracking-tight">
            Falta para o máximo do Centro de Vila {current.townHallLevel}
          </h2>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            Com {player.builders} construtores e nenhum tempo ocioso — o cenário perfeito, não o
            provável.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Upgrades" value={formatNumber(remaining.upgrades)} />
          <Metric
            label="Tempo (caminho crítico)"
            value={formatDuration(remaining.criticalPathSec)}
          />
          {Object.entries(remaining.costByResource)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([resource, amount]) => (
              <Metric
                key={resource}
                label={RESOURCE_LABELS[resource] ?? resource}
                value={formatNumber(amount)}
              />
            ))}
        </div>

        <div className="flex flex-col gap-2">
          {remaining.byTrack.map((track) => (
            <div key={track.track} className="flex items-baseline justify-between text-[13px]">
              <span>{TRACK_LABELS[track.track]?.title ?? track.track}</span>
              <span className="tabular" style={{ color: "var(--text-secondary)" }}>
                {formatNumber(track.upgrades)} upgrades · {formatDuration(track.parallelTimeSec)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {current.maxProgressBp !== null ? (
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Progresso atual: <strong className="tabular">{formatBp(current.maxProgressBp)}</strong>.
          Estes números cobrem só as categorias com dado —{" "}
          <Link href="/vila" className="underline underline-offset-4">
            preencha o registro da vila
          </Link>{" "}
          para incluir defesas, muralhas e armadilhas.
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[11px] font-medium tracking-wide uppercase"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <span className="tabular text-[18px] leading-none font-semibold tracking-[-0.02em]">
        {value}
      </span>
    </div>
  );
}

function CandidateRow({
  candidate,
  position,
}: {
  readonly candidate: UpgradeCandidate;
  readonly position: number;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="tabular mt-0.5 text-[12px] font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        {position}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px]">
          {candidate.name}{" "}
          <span className="tabular" style={{ color: "var(--text-secondary)" }}>
            {candidate.fromLevel} → {candidate.toLevel}
          </span>
        </span>
        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {formatNumber(candidate.costAmount)}{" "}
          {RESOURCE_LABELS[candidate.costResource] ?? candidate.costResource} ·{" "}
          {formatDuration(candidate.timeSec)} · fecha{" "}
          {formatBp(candidate.progressGainBp, "pt-BR", 2)} do progresso
        </span>
      </div>
    </li>
  );
}
