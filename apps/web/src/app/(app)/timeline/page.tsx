import { formatBp } from "@clashpilot/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrendChart } from "@/components/charts/trend-chart";
import { formatDate, formatNumber } from "@/lib/utils";
import { getPrimaryPlayer } from "@/server/session";
import { type TimelineEvent, loadEvents, loadSnapshots } from "@/server/timeline";

export const metadata: Metadata = { title: "Timeline" };

const EVENT_LABEL: Record<string, (e: TimelineEvent) => string> = {
  TH_UP: (e) => `Subiu para o Centro de Vila ${e.toLevel}`,
  HERO_LEVEL_UP: (e) => `${labelKey(e.key)} ${e.fromLevel} → ${e.toLevel}`,
  TROOP_LEVEL_UP: (e) => `${labelKey(e.key)} ${e.fromLevel} → ${e.toLevel}`,
  SPELL_LEVEL_UP: (e) => `${labelKey(e.key)} ${e.fromLevel} → ${e.toLevel}`,
  PET_LEVEL_UP: (e) => `${labelKey(e.key)} ${e.fromLevel} → ${e.toLevel}`,
  EQUIPMENT_LEVEL_UP: (e) => `${labelKey(e.key)} ${e.fromLevel} → ${e.toLevel}`,
  LEAGUE_CHANGE: (e) => `Liga: ${meta(e, "from")} → ${meta(e, "to")}`,
  TROPHY_PEAK: (e) => `Novo recorde de troféus: ${formatNumber(e.toLevel ?? 0)}`,
  CLAN_CHANGE: (e) => `Clã: ${meta(e, "from")} → ${meta(e, "to")}`,
};

const EVENT_ICON: Record<string, string> = {
  TH_UP: "◆",
  HERO_LEVEL_UP: "♛",
  TROOP_LEVEL_UP: "▲",
  SPELL_LEVEL_UP: "✦",
  PET_LEVEL_UP: "❤",
  EQUIPMENT_LEVEL_UP: "⚒",
  LEAGUE_CHANGE: "◈",
  TROPHY_PEAK: "★",
  CLAN_CHANGE: "⌂",
};

function labelKey(key: string | null): string {
  if (!key) return "Item";
  return key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function meta(event: TimelineEvent, field: string): string {
  const value = event.meta?.[field];
  return typeof value === "string" ? value : "";
}

/** Agrupa eventos por dia para a lista virar seções "HOJE / ONTEM / data". */
function groupByDay(events: readonly TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  for (const event of events) {
    const day = event.at.slice(0, 10);
    const label =
      day === today
        ? "Hoje"
        : day === yesterday
          ? "Ontem"
          : formatDate(new Date(day), { dateStyle: "long" });
    const list = groups.get(label) ?? [];
    list.push(event);
    groups.set(label, list);
  }
  return groups;
}

export default async function TimelinePage() {
  const player = await getPrimaryPlayer();
  if (!player) redirect("/link-player");
  if (!player.current) redirect("/dashboard");

  const [snapshots, { events }] = await Promise.all([
    loadSnapshots(player.id, 90),
    loadEvents(player.id, 60),
  ]);

  const groups = groupByDay(events);

  return (
    <div className="flex flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Timeline</h1>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Sua evolução dia a dia. O histórico começa no primeiro sync e nunca é apagado.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TrendChart
          label="Progresso até o máximo"
          points={snapshots
            .filter((s) => s.maxProgressBp !== null)
            .map((s) => ({ x: s.on, y: s.maxProgressBp! / 100 }))}
          formatValue={(v) => formatBp(Math.round(v * 100))}
        />
        <TrendChart label="Troféus" points={snapshots.map((s) => ({ x: s.on, y: s.trophies }))} />
        <TrendChart
          label="Soma de níveis de herói"
          points={snapshots
            .filter((s) => s.heroSumLevel !== null)
            .map((s) => ({ x: s.on, y: s.heroSumLevel! }))}
        />
      </section>

      <section className="flex flex-col gap-6">
        {events.length === 0 ? (
          <p className="card p-5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Nenhum evento ainda. Assim que sua vila evoluir entre dois syncs, cada mudança aparece
            aqui: level ups, subida de liga, novo recorde.
          </p>
        ) : (
          [...groups.entries()].map(([day, dayEvents]) => (
            <div key={day} className="flex flex-col gap-2">
              <h2
                className="text-[11px] font-medium tracking-wide uppercase"
                style={{ color: "var(--text-tertiary)" }}
              >
                {day}
              </h2>
              <ul className="flex flex-col">
                {dayEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-baseline gap-3 border-b py-2.5 last:border-b-0"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <span
                      aria-hidden
                      className="w-4 text-center text-[13px]"
                      style={{ color: "var(--accent)" }}
                    >
                      {EVENT_ICON[event.type] ?? "•"}
                    </span>
                    <span className="flex-1 text-[14px]">
                      {(EVENT_LABEL[event.type] ?? (() => event.type))(event)}
                    </span>
                    <span className="tabular text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      {formatDate(new Date(event.at), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
