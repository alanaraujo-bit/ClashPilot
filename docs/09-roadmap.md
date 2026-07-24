# Roadmap

Fases pequenas, cada uma com entregável funcionando ponta a ponta. Nada de "3 semanas de
infraestrutura sem tela". Cada fase tem **Definição de Pronto** verificável.

---

## Fase 0 — Fundação (base do repositório)

- Monorepo pnpm + turborepo · `apps/web`, `apps/gateway`, `packages/{core,coc-data,contracts,ui,config}`
- Next.js 15 + React 19 + TS strict + Tailwind v4 + shadcn/ui + tokens do design system
- ESLint (com `boundaries`), Prettier, Vitest, Playwright, Husky + lint-staged
- CI GitHub Actions: typecheck · lint · test · build · Lighthouse CI
- Prisma + Postgres (Railway) com o schema de `02-modelo-de-dados.md` migrado

**Pronto quando:** `pnpm build` passa, CI verde, `/` renderiza a landing com o design system aplicado.

## Fase 1 — Gateway + integração real

- `apps/gateway` no Railway com IP fixo, chave da Supercell, HMAC, undici pool
- Rate limiter (token bucket em Redis), circuit breaker, mapeamento tipado de erros
- Cliente tipado + DTOs zod + mappers para domínio
- `GET /players/{tag}` e `POST /verifytoken` funcionando de ponta a ponta

**Pronto quando:** uma tag real retorna domínio normalizado, com cache e sem `any`, e o
teste de contrato (payload gravado) passa.

## Fase 2 — Auth + vinculação de conta

- Better Auth (e-mail/senha + Google + passkey), sessões, rate limit
- Fluxo `/link-player` com preview, verificação por token e modo observação
- `PlayerCurrent` + snapshot inicial + `requirePlayerAccess`

**Pronto quando:** um usuário novo sai do zero até ver sua vila real em < 90 s.

## Fase 3 — `packages/coc-data` + motor de progresso

- Catálogo completo do jogo (prédios, tropas, feitiços, heróis, pets, equipamentos, muralhas)
  com custo/tempo por nível e mínimo de TH — **maior tarefa de dados do projeto**
- Testes de integridade (todo item tem todos os níveis; totais batem com fonte conhecida)
- `maxProgress`, `villageScore`, `timeToMax` como funções puras com cobertura ≥ 90%

**Pronto quando:** uma vila conhecida 100% máxima calcula exatamente 100,00%.

## Fase 4 — Dashboard v1 (o primeiro "uau")

- Shell do app, sidebar/tab bar, ⌘K, tema, PWA instalável
- Barra MAX% gigante, Score ring com breakdown, tiles de resumo
- Suspense + skeletons + prefetch + animações
- PWA: manifest, ícones, splash, service worker, offline do dashboard

**Pronto quando:** Lighthouse mobile ≥ 95 nas 4 categorias em `/dashboard`.

## Fase 5 — Village Ledger + Upgrade Jobs

- Tela `/vila` em grade, com heurística "tudo no máximo do TH anterior"
- `UpgradeJob`: iniciar, cancelar, concluir; painel de construtores com contagem regressiva
- Confiança do dado + reconciliação automática no sync

**Pronto quando:** iniciar um upgrade no app faz o painel de construtores e a estimativa de
tempo até o máximo mudarem coerentemente.

> ⚠️ **Ingestão de guerra é urgente e não retroativa.** `currentwar` é uma janela que fecha:
> os ataques individuais somem quando a guerra rotaciona, o `warlog` guarda só o placar e a CWL
> nem `result` traz. Se quisermos histórico de performance de ataque, a coleta precisa começar
> **antes** do lançamento público — antecipar um job mínimo de `currentwar` já na Fase 6.

## Fase 6 — Sync diário, histórico e timeline

- Worker BullMQ: snapshot diário, hot-sync adaptativo, diff → `ProgressEvent`
- Backfill de eventos a partir de achievements
- `/timeline` com gráficos, comparações (7/30/início) e virtualização

**Pronto quando:** 7 dias de execução produzem gráficos corretos sem lacunas nem duplicatas.

## Fase 7 — Motor de prioridades + Advisor

- `priority-engine` com ROI, gargalos e restrições
- `/plano` com simulação (builders, livro, martelo)
- Advisor de duas camadas (funções puras → Claude para redação), streaming, histórico
- Checklist "posso subir de TH?"

**Pronto quando:** as 5 perguntas do briefing são respondidas com números rastreáveis.

## Fase 8 — Notificações + alertas

- Web Push VAPID, preferências, quiet hours, agendamento server-side
- Alertas: builder livre, lab, recursos, escudo, boost, guerra, temporada, eventos

**Pronto quando:** o push de "builder livre" chega com o app fechado, no Android e no iOS instalado.

## Fase 9 — Analytics, insights, metas, conquistas, gamificação

- `/stats` completo, eficiência, desperdício, economia de livro/martelo
- Regras de insight, metas com projeção, conquistas + tiers Planner
- Calendário de eventos

## Fase 10 — Polimento e lançamento

- Perfil público + OG image, SEO, i18n (pt-BR/en), telemetria (Vercel Analytics + Sentry)
- Auditoria de acessibilidade, testes E2E dos fluxos críticos, orçamento de bundle
- Exportação/exclusão de dados (LGPD), página de status, documentação pública

---

## Diferenciais propostos (além do briefing)

Ordenados por (valor ÷ esforço). Todos servem ao objetivo central de eficiência:

1. **Simulador "e se…"** — arrastar builders, livros e martelos e ver a data de vila máxima
   mudar em tempo real. É a feature mais vendável do produto.
2. **Custo de oportunidade de subir de TH** — quantificar em dias o atraso de subir cedo.
   Nenhum app do mercado responde isso com o dado do próprio jogador.
3. **Planejador de temporada** — encaixar upgrades no fim de temporada/Clan Games para
   consumir recompensas (livros/martelos) no ponto de maior retorno.
4. **Ritmo de farm inferido** — derivar taxa de ouro/elixir/dia dos achievements cumulativos
   e usar como restrição real no plano (é o gargalo verdadeiro, não o builder).
5. **Modo clã (v2)** — visão do líder: quem está parado, quem está rusheado, quem doa.
   Multiplica o crescimento (1 líder traz 40 membros).
6. **Widget/atalho de "próxima jogada"** — notificação diária única com a única decisão do dia.
7. **Digest semanal por e-mail** — retenção barata, gerado pelo mesmo motor de insights.
8. **Exportação CSV/JSON do histórico** — confiança e diferencial contra apps fechados.
