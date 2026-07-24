# Sincronização, cache e notificações

---

## 1. Pipeline de sincronização

```
BullMQ (gateway)
  ├─ cron 03:10 UTC ── daily-snapshot ── todos os players com syncEnabled
  ├─ cron */15 min ─── hot-sync ──────── players "quentes" (ver 1.2)
  ├─ cron */1 min ──── alerts ────────── Alert.status=SCHEDULED AND fireAt <= now
  └─ on-demand ─────── manual-refresh ── botão do usuário (throttle 60 s/player)
```

### 1.1 `sync-player` — o único caminho de escrita

```
1. fetch  GET /players/{tag}          (com cache Redis 120 s)
2. valida DTO com zod                 → falha ⇒ log + alerta ao mantenedor, não quebra o app
3. mapeia DTO → domínio (UnitState[]) → normaliza pets/super-tropas/builder base
4. diff   contra PlayerCurrent        → ProgressEvent[] (level ups, TH, liga, clã, picos)
5. calcula VillageScore, maxProgressBp, timeToMax  (funções puras de @clashpilot/core)
6. persiste em transação:
     upsert PlayerCurrent
     upsert PlayerSnapshot (playerId, capturedOn)   ← idempotente
     insert ProgressEvent[]
     insert PlayerSnapshotRaw (gzip)
7. pós-processo (fila separada, não bloqueia):
     regras de insight → Insight[]
     motor de conquistas → UnlockedAchievement[] + XP → PlannerTier
     reconciliação de UpgradeJob (job cujo endsAt passou e cujo nível bateu ⇒ DONE)
     agenda Alert[] futuros
8. invalida cache de leitura (tag `player:{id}`) e notifica a web via webhook
```

Todo o passo 3–5 é **puro**: entrada `(rawPlayer, previousState, ledger, clock)`,
saída `(nextState, events, metrics)`. Isso permite reprocessar 1 ano de histórico
offline se um cálculo mudar — e é o que torna o sistema auditável.

### 1.2 Priorização adaptativa

Nem todo jogador precisa da mesma frequência. `syncPriority` recalculado diariamente:

| Faixa    | Critério                                                        | Intervalo                                   |
| -------- | --------------------------------------------------------------- | ------------------------------------------- |
| Quente   | sessão nas últimas 24 h **ou** `UpgradeJob` terminando em < 2 h | 15 min                                      |
| Morno    | ativo nos últimos 7 dias                                        | 2 h                                         |
| Frio     | resto                                                           | 1×/dia (snapshot)                           |
| Dormente | sem login há 60 dias                                            | 1×/semana + e-mail "ainda quer acompanhar?" |

Isso mantém o consumo da API linear com **usuários ativos**, não com contas cadastradas —
condição para escalar sem estourar rate limit.

---

## 2. Estratégia de cache (4 camadas)

| #   | Camada                         | O que guarda                                           | TTL                                  | Invalidação               |
| --- | ------------------------------ | ------------------------------------------------------ | ------------------------------------ | ------------------------- |
| 1   | Upstash Redis (gateway)        | respostas cruas da API CoC                             | 120 s player / 600 s clã / 24 h liga | por tempo                 |
| 2   | Upstash Redis (app)            | resultados de use case caros (stats 90 d, prioridades) | 10 min                               | tag `player:{id}` no sync |
| 3   | Next.js `unstable_cache` / ISR | páginas públicas, catálogo, calendário                 | 1 h                                  | `revalidateTag`           |
| 4   | TanStack Query (cliente)       | tudo que a UI já viu                                   | `staleTime` 60 s, `gcTime` 24 h      | invalidação por mutation  |
| 5   | Service Worker (PWA)           | shell, assets, último dashboard                        | stale-while-revalidate               | versão do build           |

Regras:

- **Nunca** duas camadas com a mesma chave e TTLs divergentes → chave canônica em
  `packages/contracts/cache-keys.ts`, função pura `cacheKey.player(id)`.
- Redis é _cache_: perder o Redis inteiro não pode causar erro, só lentidão. Todo `get`
  tem caminho de fallback ao banco.
- `staleTime` do TanStack alinhado ao TTL do servidor evita "número piscando" ao navegar.

---

## 3. PWA

- **Serwist** (sucessor mantido do `next-pwa`) com estratégias por rota:
  - `document` → NetworkFirst com timeout 3 s → fallback offline shell
  - `/_next/static/*`, fontes, ícones → CacheFirst (1 ano, imutável)
  - `/api/*` → NetworkOnly, exceto `GET /api/snapshot/latest` → StaleWhileRevalidate
- **Offline parcial**: dashboard do último sync, todas as calculadoras (rodam sobre
  `coc-data`, 100% client-side), timeline em cache, e fila de escrita (ledger editado
  offline) via Background Sync.
- **Atualização automática**: novo SW → `skipWaiting` só depois de um toast
  "Nova versão disponível — atualizar", para não trocar o bundle no meio de um fluxo.
- Manifest: `display: standalone`, `theme_color` dinâmico por esquema, ícones
  192/512 + maskable, screenshots (habilita o prompt rico de instalação),
  `shortcuts` para Dashboard/Plano/Advisor.
- iOS: splash screens geradas por device (`apple-touch-startup-image`), `viewport-fit=cover`,
  `safe-area-inset` no shell.

## 4. Notificações push

- **Web Push (VAPID)** — funciona em Android, desktop e iOS 16.4+ **desde que instalado**
  na tela de início. Onboarding de notificação explica isso no iOS, senão vira suporte.
- Agendamento server-side (`Alert.fireAt`) — o SW nunca "acorda sozinho"; quem dispara é
  o worker. Isso é o que faz "builder livre" funcionar com o app fechado.
- Deduplicação por `tag` da Notification + `renotify: false`.
- Quiet hours por usuário; digest semanal agrupado em vez de N alertas.
- Falha 410/404 no endpoint → remove `PushSubscription` (higiene automática).

### Alertas e suas fontes

| Alerta                                      | Fonte                                             | Requer camada B |
| ------------------------------------------- | ------------------------------------------------- | --------------- |
| Builder livre / Lab terminou / Job terminou | `UpgradeJob.endsAt`                               | sim             |
| Recursos quase cheios                       | capacidade (`coc-data`) + taxa de coleta estimada | sim             |
| Escudo / Boost terminando                   | timer declarado no app                            | sim             |
| Ataque de guerra pendente                   | `currentwar` + `attacks` do membro                | não             |
| Fim de temporada / Gold Pass                | `/goldpass/seasons/current`                       | não             |
| CWL, Clan Games, Capital Raid               | calendário derivado + `leaguegroup`               | não             |
| Cutucão de ociosidade                       | ausência de eventos há N dias                     | não             |
