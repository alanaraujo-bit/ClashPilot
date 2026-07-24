# HANDOFF — estado do projeto para continuar em outro chat

> Leia este arquivo primeiro. Depois `README.md` e `docs/00-visao-e-escopo.md`.
> Última atualização: 2026-07-24, fim da Fase 6.

Você é o arquiteto do **ClashPilot** — copiloto estratégico de evolução de vila para Clash of
Clans. Não automatiza nada no jogo: lê a API oficial, guarda histórico e recomenda upgrades.
Idioma do produto e dos commits: **português (pt-BR)**.

---

## 1. TL;DR — onde paramos

Fases **0 a 7 e 6 entregues e no ar** (a ordem de execução não seguiu a numeração do roadmap).
Tudo commitado e deployado. **99 testes passando**, typecheck strict sem `any`, build verde.

**A única pendência que atravessa tudo:** nenhum número foi conferido contra uma **vila ativa
real**. Só contra a conta dormente de teste `#2PP` (TH8, sem heróis, sem ledger). Progresso,
ROI, tempo até o máximo e timeline são internamente consistentes e plausíveis, mas ninguém
validou olhando o próprio jogo ao lado. **Essa validação é a próxima tarefa e vale mais que
qualquer feature nova.**

### Como fazer a validação (a tarefa pendente)

1. O usuário (Alan) entra em https://clashpilot.vercel.app, cria conta, vincula a vila dele
   com o token da API do jogo (modo verificado) e preenche `/vila` (o registro).
2. Ele passa a **tag** da vila no chat.
3. Você roda, com o `GATEWAY_SECRET` (ver §5):
   `$env:GATEWAY_SECRET="<segredo>"; pnpm --filter @clashpilot/gateway run sanity "#TAG"`
   Isso imprime progresso, score, próximas jogadas e tempo até o máximo.
4. Compare linha a linha com o que o jogo mostra ao Alan. Ajuste pesos/semântica se divergir.

---

## 2. O que está no ar (produção)

| Peça              | Onde                                                          | URL                                                           |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Web (Next.js)     | Vercel · projeto `clashpilot` (scope `alan-araujos-projects`) | https://clashpilot.vercel.app                                 |
| Gateway (Fastify) | Railway · projeto `ClashPilot` · serviço `gateway`            | https://gateway-production-c67a.up.railway.app                |
| PostgreSQL        | Railway · serviço `Postgres`                                  | (URL pública em `$env:TEMP\cp-db-url.txt` na máquina do Alan) |
| GitHub            | —                                                             | https://github.com/alanaraujo-bit/ClashPilot                  |

- **Deploy automático:** `push` em `main` → Vercel (web) + Railway (gateway). O Railway só
  rebuilda quando muda `apps/gateway`, `packages/core`, `packages/coc-data` ou o lockfile.
- **Chave da API do CoC:** ativa, `developer/silver`, allowlist `45.79.218.79` (IP do proxy
  RoyaleAPI). Vive só no Railway em `COC_API_TOKEN`. O gateway sai pelo proxy porque o IP do
  Railway não é fixo (ADR-001, ver `docs/11-operacao.md §2`).
- **Detalhe:** existe no banco um jogador `#GR0VR9VGP` que **não é de teste nosso** — pode ser
  um usuário real. NÃO apagar.

Detalhes operacionais completos e a lista de armadilhas já resolvidas: **`docs/11-operacao.md`**.

---

## 3. Arquitetura em uma tela

Monorepo pnpm + turborepo. Regra: dependência sempre de fora para dentro.

```
apps/
  web/       Next.js 15 (App Router), Tailwind v4, Better Auth. Deploy na Vercel.
  gateway/   Fastify. Único que fala com a Supercell (detém a chave) + worker de sync. Railway.
packages/
  core/      DOMÍNIO PURO, zero I/O. É o cérebro. Tudo testado aqui.
  coc-data/  Catálogo do jogo (custo/tempo por nível) gerado dos arquivos oficiais + scripts.
  contracts/ HMAC compartilhado web⇄gateway + schemas zod das respostas.
  db/        Prisma (engineType="client", sem engine nativo — ADR-013) + adapter pg.
  config/    tsconfig/eslint compartilhados.
docs/        00..11 + este HANDOFF. Leia 00 e 10 (ADRs) para entender os "porquês".
```

**Fluxo de leitura:** Vercel → (HMAC) → gateway → (proxy IP fixo) → API CoC → zod → domínio.
**Fluxo de escrita:** só o worker do gateway escreve histórico.

---

## 4. O que cada fase entregou (o que já funciona)

- **Fase 0** — monorepo, CI, design system "Quiet Precision", landing.
- **Fase 1** — gateway: cliente da API com rate-limit, erros tipados, HMAC, failover de proxy.
- **Fase 2** — Better Auth (sessão em banco), fluxo `/link-player` (verificado + observação),
  dashboard inicial. **Validado em produção 6/6.**
- **Fase 3** — `packages/coc-data`: catálogo gerado dos CSVs oficiais do jogo (177 itens,
  2.286 níveis). Ver §6.
- **Fase 5** — Village Ledger (`/vila`): grade por categoria (defesas, muralhas, armadilhas,
  infra) com heurística "tudo no máximo do CV anterior". Leva a cobertura de ~53% a 100%.
- **Fase 7** — motor de prioridades (`/plano`): ROI = ganho de progresso por dia, filas
  paralelas por trilha (construtor/lab/herói/ferraria), tempo até o máximo pelo caminho crítico.
- **Fase 6** — sync diário (cron 03:10 UTC no gateway), diff de eventos, snapshots idempotentes,
  timeline (`/timeline`) com gráficos SVG + lista de eventos. **Pipeline validado em produção.**

Rotas web: `/` `/sign-in` `/sign-up` `/link-player` `/dashboard` `/vila` `/plano` `/timeline`.

---

## 5. Como rodar e comandos úteis (Windows / PowerShell)

O ambiente é Windows. Bash tool também existe. A URL do banco fica em
`$env:TEMP\cp-db-url.txt` e o segredo HMAC do gateway em `$env:TEMP\cp-gateway-secret.txt`
(na máquina do Alan — se o novo chat for noutra máquina, pegar via `railway variables`).

```powershell
# sempre exportar antes de typecheck/build (o Prisma precisa)
$url = Get-Content "$env:TEMP\cp-db-url.txt" -Raw
$env:DATABASE_URL=$url; $env:DIRECT_URL=$url; $env:BETTER_AUTH_SECRET="qualquer-32-chars-para-build-local"

pnpm run typecheck          # 7 pacotes
pnpm run test               # 99 testes
pnpm --filter @clashpilot/web run build

# regenerar o catálogo do jogo (após balance update — trocar fingerprint antes; ver §6)
pnpm --filter @clashpilot/coc-data build:catalog

# sanity de uma vila real (precisa GATEWAY_SECRET)
$env:GATEWAY_SECRET=(Get-Content "$env:TEMP\cp-gateway-secret.txt" -Raw).Trim()
pnpm --filter @clashpilot/gateway run sanity "#2PP"

# disparar sync manual em produção (POST assinado, SEM content-type — corpo vazio)
#   ver receita completa no histórico; endpoints: POST /sync/all e /sync/player/:id

# consultar o banco de produção: use o pacote `pg` a partir de packages/db
#   (o client gerado do Prisma NÃO importa em script avulso — ADR-013)
```

**Credenciais das CLIs:** `vercel` logado como `alanaraujo-bit`, `railway` como
`alanvitoraraujo2a@gmail.com`, `gh` NÃO está logado (push é via `git push` com credential
manager). Segredos da Vercel/Railway já configurados nos painéis.

---

## 6. Catálogo do jogo — o ativo mais delicado (ADR-004, ADR-014)

`packages/coc-data/src/generated/catalog.ts` é **gerado, não editado à mão**, a partir de
`https://game-assets.clashofclans.com/{fingerprint}/logic/*.csv` — o mesmo CDN do jogo.
Pipeline em `packages/coc-data/scripts/` (baixa, decodifica LZMA, faz cache, transforma).

- Fingerprint atual em `scripts/fingerprint.ts`. **Atualizar a cada balance update** e rodar
  `build:catalog`. É tarefa recorrente.
- **Semântica de custo (verificada, não suposta):** prédios e heróis = custo para ATINGIR o
  nível (nível 1 do herói é o altar); tropas/feitiços = upgrade DE N PARA N+1 (nível 1 grátis).
  Travado por testes-âncora em `src/generated.test.ts` — se a Supercell mudar o formato, o CI
  quebra antes do número errado chegar ao usuário.
- Gating: tropas por Laboratório, equipamentos por Ferraria (`Smithy`, TH8+), pets por Casa de
  Pets (`Pet Shop`, TH14+). Foi bug real corrigido na Fase 7.
- **Limite conhecido:** entre TH14–TH16 o denominador de pets é otimista (o mapa pet→nível da
  Casa de Pets não existe nos arquivos). Erro na categoria de menor peso (0,07), nulo abaixo de TH14.

---

## 7. Decisões que NÃO devem ser revertidas sem ler o ADR (docs/10-decisoes.md)

- **ADR-003** — modelo híbrido: API (verificado) + Village Ledger (declarado). Metade dos dados
  da vila a API não dá.
- **ADR-006** — progresso ponderado por **custo acumulado**, não por nível. `maxLevel` da API é
  o máximo GLOBAL do jogo, nunca use como teto do TH.
- **ADR-013** — Prisma sem engine nativo (`engineType="client"` + adapter `pg`). Resolveu 4
  deploys quebrados. Efeito colateral: o client gerado só funciona dentro de um bundler; script
  `.mjs` avulso não importa — use `pg` cru para consultar o banco.
- **ADR-015** — o progresso distingue "não construído" (nível 0) de "não sabemos" (sem fonte).
  Sem isso o app dizia "vila 1,6%" para um TH8. `coverageBp` = fração do peso com dado.
- **ADR-001** — gateway com IP fixo entre Vercel e Supercell; sai pelo proxy RoyaleAPI.

---

## 8. Próximos passos possíveis (escolha do Alan)

1. **(PRIORIDADE) Validar com a vila real do Alan** — ver §1. Antes de mais features.
2. **Fase 8 — Notificações push** (Web Push/VAPID): builder livre, lab terminou, fim de
   temporada. Precisa dos `UpgradeJob` (o botão "Iniciar upgrade" que alimenta a camada B).
3. **Fase 9 — Analytics e eficiência**: ocupação de builder, desperdício, velocidade de
   evolução, comparações (7d/30d/início), insights, metas, conquistas, gamificação.
4. **AI Advisor** (ADR-007): funções puras já existem (`getPriorities`, tempo até o máximo,
   readiness de TH). Falta a camada que roteia a pergunta e o LLM que só redige. Chave de LLM
   grátis pendente (ADR-012: Google AI Studio ou Groq, sem cartão).
5. **PWA completo** (Fase 4 do roadmap, parcial): manifest e ícone existem; falta service
   worker (Serwist), offline real, ícones PNG/maskable e splash de iOS.

O roadmap original está em `docs/09-roadmap.md`. A ordem acima é sugestão; o Alan decide.

---

## 9. Convenções ao continuar

- Commits e UI em pt-BR. Terminar mensagem de commit com a linha
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Nunca inventar número do jogo — sempre derivar do catálogo/dados. É o valor central do produto.
- `pnpm format` antes de commitar (Prettier). Sem `any`. Zod em toda fronteira (inclusive Json
  vindo do banco).
- Ao mexer no gateway: `pg`/`@prisma/adapter-pg`/`@prisma/client` são `external` no tsup — não
  embutir no bundle (quebra com "Dynamic require").
- Limpar dados de teste do banco ao terminar (usuários com email `@clashpilot.test`).

```

```
