# Design System — "Quiet Precision"

Referências: Linear (densidade e teclado), Arc (cor com intenção), Raycast (⌘K e velocidade
percebida), Notion (hierarquia tipográfica), Apple (movimento e material).

**Regra mestra:** nada com aparência de jogo. Nenhuma fonte display, nenhum gradiente saturado,
nenhum ícone de espada. O assunto é Clash of Clans; a _interface_ é software profissional de análise.

---

## 1. Cor

Dark-first (`dark` é o padrão; light existe e é de primeira classe). Tokens OKLCH em CSS vars,
consumidos pelo Tailwind v4 via `@theme`.

```css
/* dark */
--bg-base: oklch(0.145 0.005 275); /* quase preto, levemente frio */
--bg-surface: oklch(0.185 0.006 275);
--bg-elevated: oklch(0.225 0.008 275);
--border-subtle: oklch(1 0 0 / 0.07);
--border-strong: oklch(1 0 0 / 0.14);
--text-primary: oklch(0.97 0.004 275);
--text-secondary: oklch(0.72 0.008 275);
--text-tertiary: oklch(0.55 0.01 275);

--accent: oklch(0.68 0.17 258); /* azul-índigo, único acento de marca */
--accent-quiet: oklch(0.68 0.17 258 / 0.14);

/* semânticos — usados SÓ para significado, nunca para decorar */
--positive: oklch(0.72 0.15 155);
--warning: oklch(0.78 0.14 78);
--critical: oklch(0.63 0.19 22);
--info: oklch(0.7 0.11 230);
```

Escala de progresso (a única sequência multicolor, usada em barras e heatmaps):
`critical → warning → accent → positive`, com passos validados para contraste ≥ 4.5:1 sobre
`--bg-surface` e distinguíveis em deuteranopia.

Cor **não** é a única portadora de informação em nenhum gráfico (rótulo + forma sempre presentes).

## 2. Tipografia

- **Inter Variable** (UI) com `font-feature-settings: "cv11","ss01"; font-optical-sizing: auto`.
- **Geist Mono** para números tabulares, tags e timers — `font-variant-numeric: tabular-nums`
  em todo número que muda (impede o "pulo" de largura em contadores).
- Escala: 11 / 12 / 13 / 14 / 16 / 20 / 26 / 34 / 48. Base de UI é **14**, não 16 — densidade Linear.
- `letter-spacing` negativo progressivo em tamanhos ≥ 26 (`-0.02em` → `-0.03em`).
- Hierarquia por peso e cor, não por tamanho: 90% da UI usa 13–14 px.

## 3. Material e elevação

Glassmorphism **leve e funcional** — só em superfícies que flutuam sobre conteúdo:
topbar, command menu, sheets, popovers.

```css
.glass {
  background: color-mix(in oklch, var(--bg-surface) 72%, transparent);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-subtle);
  box-shadow:
    0 1px 0 0 oklch(1 0 0/0.04) inset,
    0 8px 32px -12px oklch(0 0 0/0.55);
}
```

Cards de conteúdo são **sólidos** — blur em card de dado prejudica legibilidade e custa GPU
no mobile. Sombra é sutil e sempre acompanhada de borda de 1px (a borda é o que dá o look Linear).

Raios: 6 (controles) / 10 (cards) / 14 (modais) / full (pills).
Espaçamento: escala de 4 px; gutter padrão 16 mobile, 24 desktop.

## 4. Movimento

Framer Motion, com orçamento rígido:

| Interação                               | Duração | Curva                                  |
| --------------------------------------- | ------- | -------------------------------------- |
| Hover / foco                            | 120 ms  | `ease-out`                             |
| Entrada de card / lista (stagger 24 ms) | 240 ms  | `[0.16,1,0.3,1]`                       |
| Sheet / modal                           | 300 ms  | spring `{stiffness:380, damping:34}`   |
| Transição de rota                       | 200 ms  | fade + 4px translateY                  |
| Barra de progresso / contador           | 900 ms  | `easeOutExpo`, uma única vez por carga |

- Só `transform` e `opacity` (nunca `height`/`top`) — 60 fps garantidos.
- `prefers-reduced-motion` desativa translate e stagger, mantém opacidade.
- Números animam com `useMotionValue` + `useTransform`, arredondando por frame.

## 5. Componentes-chave (`packages/ui`)

| Componente       | Nota de design                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `StatTile`       | rótulo 11px terciário, valor 26px mono, delta com seta e cor semântica                                              |
| `MaxProgressBar` | a barra "gigante": trilho 12px, preenchimento com gradiente do accent, marcadores de meta, número 48px mono ao lado |
| `ScoreRing`      | anel SVG 0–100, `stroke-dasharray` animado, breakdown ao clicar                                                     |
| `PriorityCard`   | posição, item, ROI, motivo em 1 linha, ação primária "Iniciar upgrade"                                              |
| `TimelineItem`   | linha vertical com nó, agrupamento por dia, ícone por `EventType`                                                   |
| `InsightCard`    | severidade na borda esquerda (2px), dispensável, com ação                                                           |
| `CommandMenu`    | ⌘K/Ctrl+K: navegar, buscar jogador, iniciar upgrade, perguntar ao Advisor                                           |
| `SkeletonX`      | um skeleton por componente real, com as MESMAS dimensões (zero CLS)                                                 |
| `EmptyState`     | ilustração geométrica minimalista + 1 ação. Nunca "nenhum dado" sozinho                                             |

## 6. Mobile first

- Layout base 360px. Desktop é _progressive enhancement_, não o contrário.
- Navegação: tab bar inferior de 5 itens no mobile (Dashboard, Plano, Advisor, Stats, Perfil);
  sidebar colapsável ≥ 1024px.
- Alvos de toque ≥ 44px; `safe-area-inset` respeitado; sheets em vez de modais no mobile.
- Gestos: pull-to-refresh no dashboard (dispara sync manual, com throttle).

## 7. Acessibilidade (meta ≥ 95)

- Contraste AA em todo texto; AAA no corpo principal.
- Foco visível com `:focus-visible` de 2px em `--accent`, nunca `outline: none`.
- Navegação completa por teclado, incluindo gráficos (tabela alternativa acessível por `aria-describedby`).
- `aria-live="polite"` em contadores de sync e toasts; `role="progressbar"` com `aria-valuetext`
  em texto humano ("72,4 por cento até vila máxima").
- Idioma `pt-BR`, números e datas via `Intl` (nunca formatação manual).
