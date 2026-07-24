# Arquitetura

Clean Architecture pragmática em monorepo pnpm. Regra de dependência: **de fora para dentro, nunca o contrário.**

```
  apps/web (UI, Next.js)  ──►  application (use cases)  ──►  domain (regras puras)
        │                              ▲
        └──► infrastructure (Prisma, Redis, CoC, Push) ─┘   implementa as ports do domínio
```

`domain/` não importa Prisma, não importa React, não importa `next/*`. É testável com `vitest`
sem nenhum mock de I/O. Esse é o critério objetivo de "a arquitetura está certa".

---

## 1. Monorepo

```
clashpilot/
├─ apps/
│  ├─ web/                    # Next.js 15 (App Router) — Vercel
│  └─ gateway/                # Fastify, IP fixo, dono da chave CoC + worker — Railway/Fly
├─ packages/
│  ├─ coc-data/               # catálogo estático do jogo (ver 02)
│  ├─ core/                   # domain + application (isomórfico, zero I/O)
│  ├─ contracts/              # zod schemas + tipos compartilhados web ⇄ gateway
│  ├─ ui/                     # design system (shadcn/ui estendido)
│  └─ config/                 # eslint, tsconfig, tailwind preset compartilhados
└─ docs/
```

Por que gateway separado: ADR-001 (IP fixo) + o worker de sync precisa de processo longo,
cron confiável e concorrência controlada — coisas que uma serverless function faz mal.

---

## 2. `packages/core` — o coração

```
packages/core/src/
├─ domain/
│  ├─ player/
│  │   ├─ player.entity.ts          # Player, UnitState, Village
│  │   ├─ player.vo.ts              # PlayerTag (value object com validação), TownHallLevel
│  │   └─ player.errors.ts
│  ├─ progress/
│  │   ├─ max-progress.service.ts   # % MAX por categoria (função pura)
│  │   ├─ village-score.service.ts  # score 0-100
│  │   └─ completion.model.ts
│  ├─ planning/
│  │   ├─ priority-engine.ts        # ranking de upgrades por ROI
│  │   ├─ time-to-max.ts
│  │   └─ upgrade-candidate.ts
│  ├─ analytics/
│  │   ├─ efficiency.service.ts     # ociosidade de builder/lab, desperdício
│  │   ├─ velocity.service.ts
│  │   └─ comparison.service.ts
│  ├─ insights/rules/*.rule.ts      # cada regra é um objeto puro testável
│  ├─ achievements/engine.ts
│  └─ ports/                        # INTERFACES, implementadas na infra
│      ├─ player.repository.ts
│      ├─ snapshot.repository.ts
│      ├─ coc.gateway.ts
│      ├─ cache.port.ts
│      ├─ clock.port.ts             # nada de `new Date()` solto no domínio
│      ├─ notifier.port.ts
│      └─ llm.port.ts
└─ application/
   ├─ use-cases/
   │   ├─ link-player.usecase.ts
   │   ├─ sync-player.usecase.ts
   │   ├─ get-dashboard.usecase.ts
   │   ├─ get-priorities.usecase.ts
   │   ├─ ask-advisor.usecase.ts
   │   ├─ start-upgrade-job.usecase.ts
   │   └─ ...
   └─ dto/                          # entrada/saída dos use cases (zod)
```

Cada use case: uma classe com `execute(input): Promise<Result<Output, AppError>>`.
`Result` explícito, sem `throw` para fluxo esperado. Dependências injetadas por construtor —
é o que torna SOLID verificável aqui (D: use case depende de `CocGateway`, não de `fetch`).

---

## 3. `apps/web`

```
apps/web/src/
├─ app/
│  ├─ (marketing)/page.tsx                    # landing, estática, SEO
│  ├─ (auth)/sign-in/  sign-up/  link-player/
│  ├─ (app)/
│  │   ├─ layout.tsx                          # shell: sidebar + topbar + providers
│  │   ├─ dashboard/page.tsx
│  │   ├─ plano/page.tsx                      # prioridades
│  │   ├─ advisor/page.tsx
│  │   ├─ timeline/page.tsx
│  │   ├─ stats/page.tsx
│  │   ├─ vila/page.tsx                       # Village Ledger
│  │   ├─ calculadoras/[tool]/page.tsx
│  │   ├─ metas/page.tsx
│  │   ├─ conquistas/page.tsx
│  │   ├─ calendario/page.tsx
│  │   ├─ perfil/[tag]/page.tsx
│  │   └─ config/page.tsx
│  ├─ api/
│  │   ├─ auth/[...all]/route.ts              # Better Auth handler
│  │   ├─ push/subscribe/route.ts
│  │   ├─ advisor/route.ts                    # streaming
│  │   └─ webhooks/gateway/route.ts           # gateway → web (sync concluído)
│  ├─ manifest.ts   sitemap.ts   robots.ts
│  └─ globals.css
├─ features/                                  # vertical slices — o que a UI realmente é
│  ├─ dashboard/{components,hooks,queries}/
│  ├─ planning/  timeline/  advisor/  ledger/  stats/  goals/  achievements/  calendar/
├─ components/
│  ├─ ui/           # shadcn (gerado, não editado à mão sem motivo)
│  ├─ charts/       # wrappers Recharts com tokens do design system
│  ├─ layout/       # AppShell, Sidebar, CommandMenu (⌘K)
│  └─ feedback/     # Skeletons, EmptyState, ErrorBoundary
├─ server/
│  ├─ actions/      # Server Actions, uma por caso de uso, com `zod` + authz
│  ├─ di.ts         # composition root: monta use cases com infra real
│  └─ session.ts
├─ hooks/           # useDashboard, useMediaQuery, useCountdown, usePushPermission
├─ lib/             # queryClient, fetcher, formatters (i18n pt-BR), cn()
├─ types/
└─ workers/sw.ts    # service worker (Serwist)
```

**Regra de fronteira:** `features/*` pode importar `components/*`, `hooks/*`, `lib/*` e
`@clashpilot/core` (tipos + use cases). `components/ui` não importa nada de `features`.
Enforçado por `eslint-plugin-boundaries` no CI — arquitetura que não é verificada apodrece.

### Server Components por padrão

- Página busca dados no servidor (via use case) e faz `prefetchQuery` no `HydrationBoundary`.
- `"use client"` só onde há estado/interação. Componentes de gráfico são client + `dynamic()`.
- Streaming com `<Suspense>` por seção do dashboard → cada card aparece quando estiver pronto,
  o shell é instantâneo. É o que sustenta a meta de LCP.

---

## 4. `apps/gateway`

```
apps/gateway/src/
├─ http/routes/{players,clans,health}.ts   # API interna, autenticada por HMAC
├─ coc/
│  ├─ client.ts          # undici pool + keep-alive
│  ├─ rate-limiter.ts    # token bucket distribuído (Redis)
│  ├─ circuit-breaker.ts
│  └─ key-manager.ts     # rotação entre múltiplas chaves
├─ jobs/
│  ├─ scheduler.ts       # BullMQ + Redis
│  ├─ daily-snapshot.job.ts
│  ├─ hot-sync.job.ts    # jogadores ativos, intervalo curto
│  ├─ alerts.job.ts      # dispara push agendado
│  └─ insights.job.ts
└─ index.ts
```

---

## 5. Padrões de código (não negociáveis)

- `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- `any` proibido por lint (`@typescript-eslint/no-explicit-any: error`); `unknown` + narrowing.
- Fronteiras validadas com zod; tipos derivados por `z.infer`, nunca duplicados à mão.
- Sem números mágicos: pesos de score e constantes de jogo vivem em `coc-data` ou `config`.
- Nomes de arquivo `kebab-case`, componentes `PascalCase`, hooks `useX`.
- Testes: `vitest` (domínio, cobertura ≥ 90% em `domain/`), `playwright` (fluxos críticos).
- Sem barrel file gigante em `features` (mata tree-shaking); barrels só em `packages/*`.
