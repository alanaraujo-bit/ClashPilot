# ADRs — Decisões arquiteturais

Formato: contexto → decisão → consequência. Uma decisão revertida ganha um ADR novo, não é apagada.

---

## ADR-001 — Gateway próprio com IP fixo entre Vercel e a API da Supercell

**Contexto.** Chaves da API do CoC são vinculadas a IPs. Funções serverless da Vercel usam IPs
dinâmicos, o que produz `403 accessDenied.invalidIp` de forma intermitente e não contornável.

**Decisão.** Um serviço `apps/gateway` (Fastify, container em **Railway**, IP estático)
detém a chave, e é o único que fala com a Supercell. A Vercel o consome via HTTP assinado com HMAC.

**Consequências.**

- (+) Rate limiting e cache **globais** e corretos, não por instância.
- (+) O worker de sync mora em processo longo, com cron confiável e concorrência controlada —
  algo que serverless faz mal.
- (+) A chave da Supercell nunca chega perto do runtime da Vercel.
- (−) Uma peça a mais de operação e ~US$ 5/mês.
- (−) Um salto extra de rede (~20–40 ms), absorvido pelo cache.
- Alternativas descartadas: proxy pago de IP fixo (custo + SPOF sem os benefícios do worker);
  registro programático de chave a cada IP novo (frágil e de legitimidade duvidosa).

**Revisão (estudo da API, `docs/api/limites-e-erros.md`):** existe um proxy comunitário gratuito
e ativo, `cocproxy.royaleapi.dev` — basta cadastrar o IP fixo _dele_ na allowlist da chave e a
Vercel consegue chamar a API direto. Isso **não muda a decisão**: o worker de sync, o cron e o
rate limiting globais continuam precisando de um processo longo, e a chave continua sem poder
morar na Vercel. Mas o proxy entra como **caminho de degradação**: se o gateway cair, o
`CocGateway` faz failover para ele e o app segue lendo dados. Configurado por env var
`COC_FALLBACK_PROXY_URL`.

## ADR-002 — Better Auth em vez de NextAuth

**Contexto.** Precisamos de sessões revogáveis, múltiplos provedores, passkeys, tipagem forte e
boa integração com Server Actions e Prisma.

**Decisão.** Better Auth.

**Consequências.** (+) Schema Prisma nativo, API de servidor totalmente tipada, plugins de
passkey/2FA/organização sem adaptador, sessões em banco com revogação real.
(−) Ecossistema menor que o do NextAuth; menos respostas prontas em fórum.
Migrar para NextAuth depois é viável porque toda a autorização passa por `requirePlayerAccess`,
não por detalhes do provedor.

## ADR-003 — Modelo híbrido de dados (API verificada + ledger declarado)

**Contexto.** A API não expõe construções, construtores, timers nem recursos — mas metade do
briefing depende disso.

**Decisão.** Duas camadas com `source` e `confidence` explícitos por valor; o app entrega valor
completo só com a camada A e desbloqueia o resto progressivamente.

**Consequências.** (+) Nenhum requisito é abandonado e nada é apresentado como certo quando é
declarado. (−) Complexidade de UX no onboarding e necessidade de reconciliação contínua.
Mitigação central: o botão "Iniciar upgrade" na tela de plano alimenta a camada B como efeito
colateral de uma ação que o usuário já quer fazer.

## ADR-004 — Catálogo do jogo como pacote versionado, não como tabela

**Decisão.** `packages/coc-data` em TypeScript/JSON, com `gameVersion` e checksum.

**Consequências.** (+) Tree-shakeable → calculadoras rodam offline no PWA; (+) diff auditável
a cada balance update; (+) zero I/O em cálculo puro. (−) Balance update exige deploy.
(−) É trabalho de curadoria recorrente — está no roadmap como tarefa permanente, com testes
de integridade para que um erro de digitação não corrompa o MAX% de todo mundo.

## ADR-005 — Snapshot + evento (redundância deliberada)

**Decisão.** Guardar foto diária **e** log de deltas.

**Consequências.** (+) Gráficos leem uma tabela sem window function; timeline lê outra sem
diff em runtime. (−) ~2× de armazenamento — irrelevante frente ao ganho de latência e
simplicidade das queries.

## ADR-006 — Progresso ponderado por custo, não por nível

**Decisão.** MAX% pondera cada item pelo custo acumulado (proxy de tempo de builder).

**Consequências.** (+) O número reflete o esforço real e não pula de forma absurda quando o
usuário sobe de TH. (−) Depende inteiramente da qualidade de `coc-data` (ver ADR-004).
(−) Fica mais baixo que o de apps concorrentes que contam níveis — precisa ser explicado na UI.

## ADR-007 — LLM só redige; o cálculo é determinístico

**Decisão.** O Advisor roteia para funções puras e passa o resultado estruturado ao modelo,
que apenas escreve a explicação em pt-BR.

**Consequências.** (+) Zero alucinação numérica; (+) respostas reproduzíveis via `contextHash`;
(+) custo por resposta baixo e previsível; (+) o produto funciona sem LLM (templates de fallback).
(−) Menos "conversa aberta" — o Advisor recusa perguntas fora do domínio da vila, o que é
deliberado.

## ADR-008 — Score exibe breakdown obrigatoriamente

**Decisão.** Nenhum número composto (Score, ROI, tempo até o máximo) aparece sem que o usuário
possa abrir os fatores que o produziram.

**Consequência.** Custa espaço de UI, mas é o que transforma o app de "número bonito" em
ferramenta de decisão — e é o único jeito honesto de exibir uma estimativa.

## ADR-009 — Basis points para percentuais persistidos

**Decisão.** Percentuais no banco como inteiro em basis points (`7240` = 72,40%).

**Consequência.** Evita `float` em agregações e comparações de histórico; formatação fica na UI.

## ADR-010 — Português como idioma principal, arquitetura i18n desde o dia 1

**Decisão.** Copy em pt-BR, mas todas as strings via catálogo (`next-intl`), datas e números
via `Intl`.

**Consequência.** Custo inicial pequeno; abre o mercado de língua inglesa (muito maior) sem
refatoração.

## ADR-011 — PostgreSQL no Railway, colocado com o gateway

**Contexto.** O worker de sync é o maior escritor do sistema (snapshot diário + eventos de todos
os jogadores). Ele mora no gateway, por causa do ADR-001.

**Decisão.** Postgres no Railway, mesma região e mesmo projeto do gateway. O worker acessa pela
rede privada (`*.railway.internal`); a Vercel acessa pela URL pública com connection pooling
(PgBouncer em modo transaction, `?pgbouncer=true&connection_limit=1` no Prisma).

**Consequências.**

- (+) Latência de escrita ~1 ms no caminho mais quente, sem custo de egresso.
- (+) Uma conta e um painel a menos; backups e métricas no mesmo lugar do serviço.
- (−) Sem free tier permanente (Railway dá crédito mensal; a partir de certo uso é ~US$ 5–10/mês
  para banco + gateway juntos).
- (−) Perdemos os extras do Supabase (Storage, Realtime, Auth pronto). Nenhum deles está no
  caminho crítico: Auth é Better Auth com Prisma, e não há upload de arquivo no produto.
- Migrar depois é só trocar `DATABASE_URL` + `pg_dump` — nada no código conhece o provedor.

## ADR-012 — LLM plugável, com free tier como padrão de lançamento

**Contexto.** O Advisor precisa de um modelo de linguagem, mas o projeto não tem orçamento nem
cartão de crédito disponível agora. O ADR-007 já garante que o LLM **só redige** — ele nunca
calcula — então o requisito real é "escrever bem 200 tokens em pt-BR a partir de um JSON".
Esse é um requisito modesto, e vários modelos gratuitos o atendem.

**Decisão.** Uma porta `LlmPort` com cadeia de fallback configurada por env var:

| Ordem | Provedor         | Modelo                    | Cartão? | Observação                                       |
| ----- | ---------------- | ------------------------- | ------- | ------------------------------------------------ |
| 1     | Google AI Studio | `gemini-2.5-flash`        | **não** | free tier com limite diário alto; ótimo em pt-BR |
| 2     | Groq             | `llama-3.3-70b-versatile` | **não** | grátis, latência muito baixa, bom para streaming |
| 3     | OpenRouter       | modelos `:free`           | **não** | rede de segurança, sem SLA                       |
| 4     | —                | templates determinísticos | —       | o Advisor **funciona sem nenhum LLM**            |

Como conseguir as chaves (5 minutos, sem cartão):
`aistudio.google.com/apikey` → "Create API key" com conta Google.
`console.groq.com/keys` → login com Google/GitHub → "Create API Key".

**Consequências.**

- (+) Custo zero para lançar e validar o produto.
- (+) O nível 4 significa que uma queda de quota degrada a qualidade do texto, nunca a
  disponibilidade do produto — porque os números vêm do nosso motor, não do modelo.
- (−) Free tiers têm limite de requisições por minuto/dia: o rate limit por usuário
  (30 msg/dia) e a geração de insights em lote (1×/dia, agrupada) já respeitam isso por design.
- (−) Qualidade de redação abaixo de `claude-sonnet-5`. Aceitável enquanto o texto é curto e
  factual; a troca é de uma linha de env var quando houver orçamento.
