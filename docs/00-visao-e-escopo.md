# ClashPilot — Visão, Escopo e Reality Check

> Copiloto estratégico de evolução de vila para Clash of Clans.
> Não automatiza nada dentro do jogo. Lê dados oficiais, guarda histórico e transforma isso em decisão.

---

## 1. Proposta de valor

Um jogador de CoC toma ~5 decisões caras por semana (qual upgrade iniciar, subir TH ou não,
gastar livro/martelo, investir em muralha). Essas decisões são tomadas por intuição e são
irreversíveis em termos de tempo. O ClashPilot responde **"qual é a próxima jogada de maior
retorno"** com base em dados reais + histórico próprio.

Três pilares:

| Pilar          | Pergunta que responde                                                 |
| -------------- | --------------------------------------------------------------------- |
| **Estado**     | Onde minha vila está hoje? (Score, MAX%, faltas)                      |
| **Trajetória** | Estou evoluindo rápido ou desperdiçando tempo? (Timeline, eficiência) |
| **Decisão**    | O que faço agora? (Advisor, prioridades, calculadoras)                |

---

## 2. Reality check da API oficial — LEIA ANTES DE TUDO

Três restrições duras foram levantadas no estudo da API. Elas não invalidam nenhum requisito,
mas mudam **de onde vem o dado**. Detalhes em [`01-api-clash.md`](./01-api-clash.md).

### 2.1 A API **não** expõe o estado das construções

`GET /players/{tag}` retorna: TH, XP, troféus, liga, guerra, doações, **níveis de tropas,
feitiços, heróis, pets e equipamentos**, e conquistas. **Não retorna**:

- nível de canhões, torres, muralhas, coletores, quartéis, laboratório, castelo…
- construtores livres / ocupados
- timers de upgrade e de laboratório
- recursos em caixa (ouro / elixir / EN)
- escudo, boosts, status de eventos

Consequência: **"Vila 72,4% MAX", "Ouro necessário", "Builder livre" e "Laboratório terminou"
não podem ser derivados só da API.** Precisam de uma segunda fonte.

**Solução adotada — modelo híbrido de duas camadas:**

| Camada             | Fonte                                                | Confiança                            | Cobre                                                                                                     |
| ------------------ | ---------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **A — Verificada** | API oficial (sync automático)                        | 100%                                 | Tropas, feitiços, heróis, pets, equipamentos, TH, troféus, XP, liga, doações, guerra, capital, conquistas |
| **B — Declarada**  | _Village Ledger_: o usuário informa uma vez e mantém | Declarada, com validação de sanidade | Defesas, muralhas, coletores, construtores, timers em andamento                                           |

A camada B é onde a maioria dos apps do gênero falha por atrito. Mitigações desenhadas:

1. **Onboarding em 90 s**: ao informar o TH, o app assume _"tudo no nível máximo do TH anterior"_
   (heurística verdadeira para ~80% das contas) e pede só as exceções.
2. **Edição em grade**, não em formulário: uma tela tipo planilha, teclado numérico, 1 toque por prédio.
3. **Inferência cruzada**: várias conquistas da API são provas diretas de estado
   (ex.: `Wall Buster` conta paredes destruídas — não serve; mas `Get those Goblins`, `Sweet Victory`,
   `Empire Builder` (nível do TH), `Gold Grab`/`Elixir Escapade` (total coletado) dão
   limites inferiores de progresso e detectam conta abandonada). Ver [`06-inteligencia.md`](./06-inteligencia.md).
4. **Auto-decay de confiança**: um dado declarado há 40 dias vira "precisa confirmar?" — um card, não um bloqueio.
5. **Timers derivados**: quando o usuário inicia um upgrade no app (1 toque a partir da recomendação),
   o app conhece o `endsAt` e passa a alimentar builder-livre, lab-terminou, ociosidade e eficiência
   **sem nenhum input extra**. É o loop que sustenta metade das features de analytics.

> Decisão de produto: a camada A funciona **sozinha** e já entrega valor no primeiro segundo
> (score de exército, heróis, timeline, comparações, conquistas). A camada B é _progressive
> disclosure_ — desbloqueia MAX%, custos e builders. Nada bloqueia o onboarding.

### 2.2 A API exige **IP fixo** no token

Chaves do `developer.clashofclans.com` são vinculadas a até 10 IPs. **Vercel Serverless não tem IP
fixo.** Sem tratar isso, 100% das requisições retornam `403 accessDenied.invalidIp`.

Opções avaliadas:

| Opção                                                                    | Custo        | Veredito                                           |
| ------------------------------------------------------------------------ | ------------ | -------------------------------------------------- |
| Proxy com IP estático (Fixie / QuotaGuard)                               | pago         | funciona, adiciona latência e SPOF                 |
| Worker próprio em VPS com IP fixo (Fly.io/Railway/Hetzner)               | ~US$ 0–5/mês | **Escolhido**                                      |
| Auto-registro de chave por IP na hora (login programático no dev portal) | grátis       | frágil, TOS-cinzento, descartado                   |
| Proxies comunitários (RoyaleAPI)                                         | grátis       | dependência de terceiro, escolhido como _fallback_ |

**Arquitetura resultante:** o Next.js na Vercel **nunca** fala com a API da Supercell.
Um serviço `coc-gateway` (container pequeno, IP fixo, Railway/Fly) detém a chave, aplica
rate-limit, cache Redis e normalização. A Vercel fala com o gateway via mTLS/HMAC.
Bônus: o gateway também roda o **worker de sync diário** — que é trabalho de fundo e não pertence
a uma function serverless com timeout.

### 2.3 Custos e tempos de upgrade **não existem na API**

Para calcular MAX%, ouro necessário e tempo restante é preciso uma **tabela estática do jogo**
(custo/tempo/nível de cada prédio, tropa, feitiço, herói, pet e equipamento por TH).

Decisão: pacote versionado no repositório — `packages/coc-data` — em JSON tipado, com
`gameVersion`, checksum e testes de integridade. Atualizado a cada balance update.
É um ativo de manutenção real e está no roadmap como tarefa recorrente, não como "detalhe".

---

## 3. Escopo v1.0 (o que entra)

Tudo do briefing, organizado por dependência de dados:

**Só camada A (funciona no dia 1)**
Dashboard resumo · Score de exército/heróis · Timeline e gráficos · Comparações
(semana/mês/início) · Conquistas internas · Gamificação (Planner Bronze→Diamond) ·
Calendário de eventos · Perfil · Insights de atividade · Alertas de liga/temporada

**Camada A + B**
Progress bar MAX% geral e por categoria · Village Score completo · Planejamento inteligente
de prioridades · AI Advisor · Todas as calculadoras · Alertas de builder/lab ·
Analytics de eficiência e desperdício · Metas com projeção de data

## 4. Fora de escopo (explícito)

- Qualquer automação, macro, bot ou leitura de tela do jogo
- Scraping de fontes não oficiais para dados de conta
- Compartilhamento público de dados de outros jogadores sem consentimento
- Base layouts / links de layout (nada a ver com o objetivo)

## 5. Métricas de sucesso do produto

- **TTFV** (time to first value) < 30 s do login à primeira recomendação acionável
- Retenção D7 > 40% (o app precisa dar motivo para voltar todo dia → alertas + snapshot diário)
- % de contas com camada B preenchida > 60% em 7 dias
- Lighthouse ≥ 95 nas 4 categorias, em mobile, na rota `/dashboard`

## 6. Índice da documentação

| Doc                                              | Conteúdo                                                        |
| ------------------------------------------------ | --------------------------------------------------------------- |
| [01-api-clash.md](./01-api-clash.md)             | Estudo da API oficial, endpoints, limites, verificação de conta |
| [02-modelo-de-dados.md](./02-modelo-de-dados.md) | Schema Prisma, estratégia de histórico                          |
| [03-arquitetura.md](./03-arquitetura.md)         | Clean Architecture, pastas, camadas, serviços                   |
| [04-auth.md](./04-auth.md)                       | Better Auth + verificação de propriedade da conta CoC           |
| [05-sync-e-cache.md](./05-sync-e-cache.md)       | Pipeline de sincronização, cache multicamada, notificações      |
| [06-inteligencia.md](./06-inteligencia.md)       | Village Score, MAX%, motor de prioridade, Advisor, insights     |
| [07-design-system.md](./07-design-system.md)     | Linguagem visual, tokens, motion                                |
| [08-wireframes.md](./08-wireframes.md)           | Todas as telas                                                  |
| [09-roadmap.md](./09-roadmap.md)                 | Fases, entregáveis, definição de pronto                         |
| [10-decisoes.md](./10-decisoes.md)               | ADRs — decisões arquiteturais e seus porquês                    |
