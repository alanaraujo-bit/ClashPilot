# ClashPilot

Copiloto estratégico para evolução de vila no Clash of Clans.
Analisa os dados da API oficial, guarda histórico e transforma isso em decisões de upgrade.

**Não automatiza nada dentro do jogo.** Só análise, planejamento e otimização.

---

## Estado atual

🟢 **Fases 0–7 no ar.** Auth, catálogo oficial do jogo, Village Ledger, motor de prioridades,
sync diário e timeline — todos deployados. 99 testes passando.

|         |                                                       |
| ------- | ----------------------------------------------------- |
| Web     | https://clashpilot.vercel.app                         |
| Gateway | https://gateway-production-c67a.up.railway.app/health |
| Deploy  | automático a cada `push` em `main`                    |

> **Continuando o projeto em outro chat? Comece por [docs/HANDOFF.md](docs/HANDOFF.md).**
> Ele diz exatamente onde paramos e qual é a próxima tarefa (validar os números com uma vila
> real). Detalhes de operação em [docs/11-operacao.md](docs/11-operacao.md).

## Documentação

| Doc                                                | Conteúdo                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| [HANDOFF](docs/HANDOFF.md)                         | **Estado atual e próxima tarefa — leia primeiro**         |
| [00 — Visão e escopo](docs/00-visao-e-escopo.md)   | Proposta de valor, **reality check da API**, escopo v1    |
| [01 — API do Clash of Clans](docs/01-api-clash.md) | Resumo de integração (referência completa em `docs/api/`) |
| [02 — Modelo de dados](docs/02-modelo-de-dados.md) | Schema Prisma, estratégia de histórico                    |
| [03 — Arquitetura](docs/03-arquitetura.md)         | Clean Architecture, monorepo, camadas                     |
| [04 — Autenticação](docs/04-auth.md)               | Better Auth + verificação de propriedade da conta         |
| [05 — Sync e cache](docs/05-sync-e-cache.md)       | Pipeline, cache em 5 camadas, PWA, push                   |
| [06 — Inteligência](docs/06-inteligencia.md)       | MAX%, Village Score, prioridades, Advisor, insights       |
| [07 — Design System](docs/07-design-system.md)     | Tokens, tipografia, material, motion, a11y                |
| [08 — Wireframes](docs/08-wireframes.md)           | Todas as telas                                            |
| [09 — Roadmap](docs/09-roadmap.md)                 | Fases 0–10 + diferenciais propostos                       |
| [10 — Decisões (ADRs)](docs/10-decisoes.md)        | Decisões arquiteturais e seus porquês                     |
| [11 — Operação](docs/11-operacao.md)               | Ambientes no ar, variáveis, armadilhas de deploy          |
| [docs/api/](docs/api/)                             | Referência exaustiva da API oficial                       |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui ·
Framer Motion · TanStack Query · Prisma · PostgreSQL (Railway) · Redis (Upstash) ·
Better Auth · PWA (Serwist) · Vercel (web) + Railway (gateway com IP fixo + worker) ·
LLM plugável ([ADR-012](docs/10-decisoes.md))

## Os 3 fatos que definiram a arquitetura

1. **A API não expõe construções, construtores, timers nem recursos.** → modelo híbrido de
   dados em duas camadas ([ADR-003](docs/10-decisoes.md)).
2. **Chaves da API são presas a IP e a Vercel não tem IP fixo.** → gateway próprio
   ([ADR-001](docs/10-decisoes.md)).
3. **Custos e tempos de upgrade não vêm da API.** → catálogo do jogo versionado no repo
   ([ADR-004](docs/10-decisoes.md)).
