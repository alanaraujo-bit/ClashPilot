import { formatNumber } from "@/lib/utils";

/**
 * Gráfico de tendência — área de série única em SVG puro.
 *
 * Sem biblioteca de gráfico: uma série temporal simples não justifica ~50 kB de JS no cliente,
 * e SVG estático renderiza no servidor (bom para LCP). Só `transform`/`opacity` no CSS, cor do
 * accent do design system. Acessível via `<title>` e uma tabela alternativa oculta.
 */
export function TrendChart({
  label,
  points,
  formatValue = formatNumber,
  height = 120,
}: {
  readonly label: string;
  readonly points: readonly { readonly x: string; readonly y: number }[];
  readonly formatValue?: (value: number) => string;
  readonly height?: number;
}) {
  const values = points.map((p) => p.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 100; // viewBox em unidades relativas; o SVG escala para o container

  if (points.length < 2) {
    return (
      <figure className="card flex flex-col gap-2 p-4">
        <figcaption
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </figcaption>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {points.length === 1
            ? `${formatValue(points[0]!.y)} — o gráfico aparece a partir do segundo dia de histórico.`
            : "Ainda sem histórico. Volte amanhã."}
        </p>
      </figure>
    );
  }

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.y - min) / span) * (height - 8) - 4;
    return { x, y };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = points.at(-1)!;
  const first = points[0]!;
  const trend = last.y - first.y;

  return (
    <figure className="card flex flex-col gap-2 p-4">
      <figcaption className="flex items-baseline justify-between">
        <span
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </span>
        <span className="tabular text-[13px]">
          {formatValue(last.y)}
          {trend !== 0 ? (
            <span style={{ color: trend > 0 ? "var(--positive)" : "var(--text-tertiary)" }}>
              {" "}
              {trend > 0 ? "▲" : "▼"} {formatValue(Math.abs(trend))}
            </span>
          ) : null}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[120px] w-full"
        role="img"
        aria-label={`${label}: de ${formatValue(first.y)} em ${first.x} a ${formatValue(last.y)} em ${last.x}`}
      >
        <path d={area} fill="var(--accent-quiet)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.x}>
              <th scope="row">{p.x}</th>
              <td>{formatValue(p.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
