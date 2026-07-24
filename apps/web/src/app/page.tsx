import Link from "next/link";

/**
 * Landing pública. Server Component puro: zero JavaScript de cliente, animação só em CSS.
 * É a página que sustenta as metas de SEO e Performance do Lighthouse.
 */

const pillars = [
  {
    title: "Estado",
    question: "Onde minha vila está hoje?",
    body: "Progresso até a vila máxima ponderado por custo real, Village Score com o detalhe de cada fator e o que falta em cada categoria.",
  },
  {
    title: "Trajetória",
    question: "Estou evoluindo ou desperdiçando tempo?",
    body: "Snapshot diário desde o primeiro dia. Timeline, comparações com a semana passada e ocupação real dos construtores.",
  },
  {
    title: "Decisão",
    question: "O que eu faço agora?",
    body: "A lista de upgrades ordenada por retorno, com o motivo de cada posição. Nada de palpite: os números vêm dos seus dados.",
  },
];

const questions = [
  "O que devo melhorar agora?",
  "Posso subir de Centro de Vila?",
  "Vale investir em muralhas?",
  "O que está atrasando minha evolução?",
  "Qual upgrade dá o maior retorno?",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <span className="text-[15px] font-semibold tracking-tight">ClashPilot</span>
        <Link
          href="/dashboard"
          className="rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--bg-elevated)]"
          style={{ borderColor: "var(--border-strong)" }}
        >
          Entrar
        </Link>
      </header>

      <section className="flex flex-col items-start gap-6 py-16 sm:py-24">
        <span
          className="rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase"
          style={{ background: "var(--accent-quiet)", color: "var(--accent)" }}
        >
          Em construção · Fase 0
        </span>

        <h1 className="max-w-3xl text-[2.125rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[3rem]">
          O próximo upgrade certo,
          <span style={{ color: "var(--text-tertiary)" }}> toda vez.</span>
        </h1>

        <p
          className="max-w-xl text-[15px] leading-relaxed text-pretty"
          style={{ color: "var(--text-secondary)" }}
        >
          O ClashPilot lê os dados oficiais da sua vila, guarda o histórico que o jogo não guarda e
          transforma isso na única coisa que importa: a decisão de maior retorno para hoje.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="rounded-md px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "oklch(0.99 0 0)" }}
          >
            Analisar minha vila
          </Link>
          <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Sem automação. Sem bot. Só análise.
          </span>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="card flex flex-col gap-2 p-5">
            <h2
              className="text-[11px] font-medium tracking-wide uppercase"
              style={{ color: "var(--text-tertiary)" }}
            >
              {pillar.title}
            </h2>
            <p className="text-[15px] font-medium tracking-tight">{pillar.question}</p>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {pillar.body}
            </p>
          </article>
        ))}
      </section>

      <section className="pb-20">
        <h2
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          O Advisor responde
        </h2>
        <ul className="mt-4 flex flex-col divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {questions.map((question) => (
            <li key={question} className="flex items-center gap-3 py-3 text-[14px]">
              <span
                aria-hidden
                className="tabular text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                ?
              </span>
              {question}
            </li>
          ))}
        </ul>
        <p
          className="mt-6 max-w-xl text-[13px] leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          Toda resposta é calculada por funções determinísticas sobre os seus dados — o modelo de
          linguagem só escreve a explicação. Você pode abrir o cálculo por trás de qualquer número.
        </p>
      </section>

      <footer
        className="mt-auto flex flex-col gap-1 border-t py-6 text-[12px]"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-tertiary)" }}
      >
        <p>
          ClashPilot não é afiliado à Supercell. Usa exclusivamente a API oficial do Clash of Clans.
        </p>
        <p>Clash of Clans é marca registrada da Supercell Oy.</p>
      </footer>
    </main>
  );
}
