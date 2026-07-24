import { formatBp } from "@clashpilot/core";

/**
 * A barra "gigante" de progresso até a vila máxima.
 *
 * Quando o catálogo do jogo ainda não tem custo/tempo (Fase 3), `progressBp` é `null` e a
 * barra diz isso em vez de mostrar um número inventado — ADR-008. Exibir "0%" aqui seria
 * mentira; exibir uma estimativa sem base seria pior.
 */
export function MaxProgressBar({
  progressBp,
  townHallLevel,
  villageScore,
}: {
  readonly progressBp: number | null;
  readonly townHallLevel: number;
  readonly villageScore: number | null;
}) {
  const available = progressBp !== null;
  const percent = available ? progressBp / 100 : 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          Vila máxima
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
            : "Progresso indisponível: catálogo do jogo ainda não carregado"
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
        {available ? (
          <>
            Centro de Vila {townHallLevel}
            {villageScore !== null ? ` · Village Score ${villageScore}/100` : ""}
          </>
        ) : (
          <>
            O progresso até a vila máxima depende da tabela de custos do jogo, que entra na Fase 3.
            O motor de cálculo já está pronto e testado — falta só o dado.
          </>
        )}
      </p>
    </section>
  );
}
