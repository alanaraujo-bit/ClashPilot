import { formatBp } from "@clashpilot/core";
import Link from "next/link";

/**
 * A barra "gigante" de progresso até a vila máxima.
 *
 * Regra de honestidade (ADR-008): o número **só fala sobre o que temos dado**. A API oficial
 * não expõe defesas, muralhas, armadilhas nem infraestrutura, então até o Village Ledger
 * existir a cobertura fica em torno de metade do peso da vila — e isso aparece na tela, com
 * a lista do que falta. Exibir "2,9%" sem esse contexto seria dizer ao usuário que a vila
 * dele está quase zerada.
 */

const CATEGORY_LABELS: Record<string, string> = {
  defense: "defesas",
  wall: "muralhas",
  trap: "armadilhas",
  infrastructure: "recursos e exército",
  army: "tropas e feitiços",
  hero: "heróis",
  pet: "pets",
  equipment: "equipamentos",
};

export function MaxProgressBar({
  progressBp,
  townHallLevel,
  villageScore,
  coverageBp,
  unknownCategories = [],
}: {
  readonly progressBp: number | null;
  readonly townHallLevel: number;
  readonly villageScore: number | null;
  readonly coverageBp?: number | null;
  readonly unknownCategories?: readonly string[];
}) {
  const available = progressBp !== null;
  const percent = available ? progressBp / 100 : 0;
  const partial = coverageBp !== null && coverageBp !== undefined && coverageBp < 9_900;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          {partial ? "Progresso do que já medimos" : "Vila máxima"}
        </h2>
        <p className="tabular text-[34px] leading-none font-semibold tracking-[-0.03em]">
          {available ? formatBp(progressBp) : "—"}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        {...(available ? { "aria-valuenow": percent } : {})}
        aria-valuetext={
          available
            ? `${formatBp(progressBp)} do máximo do Centro de Vila ${townHallLevel}`
            : "Progresso indisponível"
        }
        className="h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--bg-elevated)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-900 ease-out"
          style={{ width: `${percent}%`, background: "var(--accent)" }}
        />
      </div>

      <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Centro de Vila {townHallLevel}
        {villageScore !== null ? ` · Village Score ${villageScore}/100` : ""}
      </p>

      {partial ? (
        <div
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border p-4"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <p className="text-[13px]">
            Este número cobre <strong className="tabular">{formatBp(coverageBp ?? 0)}</strong> do
            peso da sua vila.
          </p>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            A API oficial do Clash of Clans não informa{" "}
            {unknownCategories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ")} — só o jogo sabe
            disso. Preencha o registro da vila uma vez e o número passa a valer pela vila inteira.
          </p>
          <Link
            href="/vila"
            className="self-start text-[13px] underline underline-offset-4"
            style={{ color: "var(--accent)" }}
          >
            Preencher registro da vila
          </Link>
        </div>
      ) : null}
    </section>
  );
}
