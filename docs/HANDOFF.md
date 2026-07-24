# HANDOFF — estado do projeto para continuar em outro chat

> Leia este arquivo primeiro. Depois `README.md` e `docs/00-visao-e-escopo.md`.
> Última atualização: 2026-07-24, fim da Fase 6.

Você é o arquiteto do **ClashPilot** — copiloto estratégico de evolução de vila para Clash of
Clans. Não automatiza nada no jogo: lê a API oficial, guarda histórico e recomenda upgrades.
Idioma do produto e dos commits: **português (pt-BR)**.

---

## 1. TL;DR — onde paramos

Fases **0 a 7 e 6 entregues e no ar** (a ordem de execução não seguiu a numeração do roadmap).
Tudo commitado e deployado. **104 testes passando**, typecheck strict sem `any`, build verde.

**Validação contra a vila real do Alan (2026-07-24) — achou QUATRO bugs de catálogo/mapper.** A
vila `#GR0VR9VGP` (`PHANT0MX`, TH6, subindo pra TH7) é do próprio Alan (não é teste; NÃO apagar). O
`sanity` + o **export cru da vila** (JSON do jogo, colado no chat) escancararam, em ordem:

1. **Gating pelo prédio produtor** — elixir negro (Golem, Bowler, Veneno…) liberado já em ~TH3
   porque o gerador gateava só pelo Laboratório. Fix: `max(TH do Lab, TH do prédio produtor)`.
2. **Entradas-fantasma** — 11 itens não-treináveis (`InvisibilityST`/`RageST`, protótipos,
   `Miner_DEF`) inflavam o denominador; o `InvisibilityST` metia 8M. Fix: filtrar `DisableProduction`.
3. **Off-by-one no gating por Laboratório** — o `LaboratoryLevel` de uma linha é o Lab do nível
   DAQUELA linha, mas o `UpgradeCost` é o custo para o PRÓXIMO. O gerador lia o requisito da linha
   errada e inflava o teto em 1: dizia "Bárbaro nível 4 no CV6" quando o jogo exige Lab 5 (=CV7).
   Fix: ler o `LaboratoryLevel` da linha que descreve o nível. Validado contra o export (Lab 4/CV6
   ⇒ Bárbaro para no 3, Raio no 4 — o teto real).
4. **Nome da API ≠ nome interno** — catálogo usa nome de arquivo (`LighningStorm`, `Gargoyle`), a
   API usa exibição (`Lightning Spell`, `Minion`); o mapper casava crus e o feitiço do jogador
   virava nível 0. Fix: `GENERATED_API_ALIASES` (gerado do `localization/texts.csv`) +
   `catalogKeyForApiName` no mapper. Nenhuma chave interna mudou.

**Resultado:** com os 4 fixes, TODAS as tropas/feitiços do Alan aparecem no máximo do CV6 — como ele
afirmava ("tá tudo full"). O app é que estava errado. O "75%" que ele via era o exército
(subcontado) puxando; agora bate.

**Nomes pt-BR (feito para o núcleo, 2026-07-24):** o CDN só expõe `texts.csv` em EN, então os nomes
oficiais em português vêm de uma **tabela curada** (`packages/coc-data/scripts/pt-names.ts`, chave→
pt-BR) montada do próprio `texts.csv` do jogo (coluna PT, mirror datamine Statscell) + Supercell/
coc.guide para o conteúdo novo. O gerador aplica em `ptName`; `/plano` (motor) e o mapper (unidades
ao vivo) exibem `ptName` via `displayNameForKey`; sem tradução, cai no EN público. **Cobertura:**
todas as tropas/feitiços/heróis + parte dos pets. **Pendente (EN por ora):** cerco novo, Ice Block,
Thrower, 6 pets, 33 equipamentos — tudo bem acima do CV6. Para completar: achar/pesquisar o nome do
jogo e adicionar em `pt-names.ts`.

**Pendências:** (a) completar a cauda de nomes pt-BR (acima). (b) validar THs mais altos (heróis,
ledger cheio). (c) ideia de produto: breakdown por categoria no dashboard, para deixar claro o que
segura o progresso.

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
- **Detalhe:** o jogador `#GR0VR9VGP` (`PHANT0MX`, TH6) no banco é a **conta real do Alan** — foi
  ele quem vinculou. NÃO apagar. É a vila usada na 1ª validação (ver §1).

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
- Gating (o mais delicado): uma unidade só existe a partir do TH em que o **prédio que a produz**
  a libera — o Laboratório só destrava os UPGRADES dela. Tropas: `ProductionBuilding` +
  `BarrackLevel` (Quartel / Quartel de Elixir Negro / SiegeWorkshop). Feitiços: `ProductionBuilding`
  + `SpellForgeLevel` (Fábrica de Feitiços / Mini Fábrica). Cada nível recebe
  `minTownHall = max(TH do Laboratório, TH do prédio produtor)`. Equipamentos por Ferraria
  (`Smithy`, TH8+), pets por Casa de Pets (`Pet Shop`, TH14+). **Corrigido em 2026-07-24** — antes
  gateava só pelo Laboratório e vazava tropa/feitiço de elixir negro para ~TH3 (achado na 1ª
  validação real, TH6). Travado por âncoras em `src/generated.test.ts` (Golem=TH8, Bowler=TH10,
  Poison=TH8, e "nenhum custo de elixir negro antes do TH7").
- Filtro de treináveis: só entram tropas/feitiços com `DisableProduction=false`. Essa flag do jogo
  exclui habilidades de Super Tropa (`InvisibilityST`…), spells de torre, protótipos e o clone
  defensivo `Miner_DEF`, que antes inflavam o denominador do exército. `EnabledByCalendar` (Super
  Tropa por evento) já era filtrado; `DisableProduction` foi somado em 2026-07-24. Army caiu de 65
  para 54 itens; âncora trava a exclusão.
- Alinhamento linha↔nível (tropas/feitiços): o `LaboratoryLevel` de uma linha é o Lab exigido para
  TER aquele nível; o `UpgradeCost` da MESMA linha é o custo de subir para o PRÓXIMO. Logo o
  requisito de Lab do nível de catálogo `index+2` vem da linha SEGUINTE (`object.levels[index+1]`).
  Ler da própria linha inflava o teto em 1 (off-by-one, corrigido 2026-07-24). Âncora: Bárbaro cap
  CV6=3 e nível 4=CV7; Raio cap CV6=4.
- Ponte de nomes API↔catálogo: `GENERATED_API_ALIASES` (mapa `nome-público→chave-interna`, gerado do
  `localization/texts.csv`) + `catalogKeyForApiName`. As unidades (army/hero/pet/equipment) recebem o
  nome público EN como `name`; o mapper resolve a chave por aí. Sem isso, `Lightning Spell` não
  casava com `lighningstorm` e o feitiço virava nível 0. `ptName` recebe o nome pt-BR oficial da
  tabela curada `scripts/pt-names.ts` (fallback EN). Exibição via `displayNameForKey`.
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
