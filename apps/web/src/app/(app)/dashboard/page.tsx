import { unitSchema } from "@clashpilot/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MaxProgressBar } from "@/components/dashboard/max-progress-bar";
import { StatTile } from "@/components/dashboard/stat-tile";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { getPrimaryPlayer } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

const unitsSchema = z.array(unitSchema);

/** O breakdown guarda a cobertura dos dados — ver `MaxProgressBar` e ADR-003. */
const breakdownSchema = z
  .object({
    coverageBp: z.number().nullable().default(null),
    unknownCategories: z.array(z.string()).default([]),
  })
  .catch({ coverageBp: null, unknownCategories: [] });

export default async function DashboardPage() {
  const player = await getPrimaryPlayer();
  if (!player) redirect("/link-player");

  const current = player.current;
  if (!current) {
    return (
      <div className="px-5 py-12">
        <p className="text-[15px] font-medium">Ainda estamos lendo sua vila.</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Atualize a página em alguns segundos.
        </p>
      </div>
    );
  }

  // O Json do banco é validado antes de virar UI — dado de banco também é fronteira.
  const parsedUnits = unitsSchema.safeParse(current.units);
  const units = parsedUnits.success ? parsedUnits.data : [];
  const breakdown = breakdownSchema.parse(current.scoreBreakdown);
  const heroes = units.filter((u) => u.category === "hero" && u.village === "home");
  const home = units.filter((u) => u.village === "home");

  return (
    <div className="flex flex-col gap-8 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{player.name}</h1>
          <p className="tabular text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {player.tag}
            {player.verified ? " · verificada" : " · modo observação"}
            {current.clanName ? ` · ${current.clanName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton playerId={player.id} />
          <Link href="/link-player">
            <Button variant="secondary">Vincular outra vila</Button>
          </Link>
        </div>
      </header>

      <MaxProgressBar
        progressBp={current.maxProgressBp}
        townHallLevel={current.townHallLevel}
        villageScore={current.villageScore}
        coverageBp={breakdown.coverageBp}
        unknownCategories={breakdown.unknownCategories}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Centro de Vila" value={String(current.townHallLevel)} />
        <StatTile label="Experiência" value={String(current.expLevel)} />
        <StatTile label="Troféus" value={formatNumber(current.trophies)} />
        <StatTile label="Melhor recorde" value={formatNumber(current.bestTrophies)} />
        <StatTile label="Liga" value={current.leagueName ?? "Sem liga"} small />
        <StatTile label="Estrelas de guerra" value={formatNumber(current.warStars)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="card p-5">
          <h2
            className="text-[11px] font-medium tracking-wide uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Heróis
          </h2>
          {heroes.length === 0 ? (
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Nenhum herói desbloqueado ainda.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {heroes.map((hero) => (
                <li key={hero.key} className="flex items-baseline justify-between text-[13px]">
                  <span>{hero.name}</span>
                  <span className="tabular" style={{ color: "var(--text-secondary)" }}>
                    {hero.level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card p-5">
          <h2
            className="text-[11px] font-medium tracking-wide uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Doações da temporada
          </h2>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <div className="flex items-baseline justify-between">
              <span>Doadas</span>
              <span className="tabular">{formatNumber(current.donations)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span>Recebidas</span>
              <span className="tabular">{formatNumber(current.donationsReceived)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span style={{ color: "var(--text-tertiary)" }}>Unidades da vila lidas</span>
              <span className="tabular" style={{ color: "var(--text-tertiary)" }}>
                {home.length}
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
