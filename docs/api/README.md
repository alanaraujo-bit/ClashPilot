# API oficial do Clash of Clans — referência para o ClashPilot

Documentação de referência da **Clash of Clans API v1** (`https://api.clashofclans.com/v1`), levantada a partir do portal oficial de desenvolvedores, de respostas HTTP reais capturadas em 2026-07 e de payloads reais da comunidade.

> ⚠️ **CORREÇÕES ÀS PREMISSAS DO PROJETO — leia primeiro**
>
> - **Premissa (b) está ERRADA.** Chamar a API a partir da Vercel **é viável** hoje, via proxy de IP fixo `https://cocproxy.royaleapi.dev` (basta cadastrar o IP `45.79.218.79` na chave). Verificado ativo em 2026-07. Ainda assim, a arquitetura correta para o ClashPilot continua sendo um ingestor próprio com IP fixo — não por impossibilidade, mas porque o produto depende de séries históricas.
> - **Premissa (a) está PARCIALMENTE ERRADA.** A API não tem endpoint de construções, mas os `achievements` expõem **níveis exatos** de algumas: `Empire Builder` = nível do **Castelo do Clã** (não do TH, como o briefing supunha), `Bigger Coffers` = **maior Armazém de Ouro**, `Master Engineering` = **Salão do Construtor**. Somando `townHallLevel`, `townHallWeaponLevel` e `clanCapital.districts[]`, dá para reconstruir bem mais do que se imaginava. Continuam invisíveis: defesas, muralhas, construtores, timers e recursos em caixa.
> - **`docs/01-api-clash.md` precisa de 3 correções:** (1) "até 10 CIDRs por chave" → o portal permite **5** (`maxCidrs || 5`, extraído do bundle JS); (2) rate limit "observado ~30–40 req/s por chave" → os wrappers maduros usam **10–30 req/s** como teto seguro, e não há header `X-RateLimit-*` para medir; (3) o exemplo de `Empire Builder` com `"value": 14` para um TH14 sugere que é o nível do TH — **é o nível do Castelo do Clã**.
> - **Premissa (c) está CORRETA e confirmada com prova direta.** Payload real de um jogador TH8: `{"name":"Barbarian","level":5,"maxLevel":12}` — no TH8 o Bárbaro trava em 5. `maxLevel` é o teto **global** do jogo.

---

## Índice

| Documento                                                | Conteúdo                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`endpoints.md`](./endpoints.md)                         | Todos os endpoints, query params, paginação, cache observado, formato de data |
| [`schemas.md`](./schemas.md)                             | Shape completo campo a campo, com tipo, obrigatoriedade e armadilhas          |
| [`limites-e-erros.md`](./limites-e-erros.md)             | JWT, allowlist de IP, rate limits, todos os erros, manutenção, contornos      |
| [`oportunidades-produto.md`](./oportunidades-produto.md) | **Análise crítica: o que cada campo viabiliza.** Documento mais importante    |
| [`exemplos/`](./exemplos/)                               | 9 payloads reais                                                              |

### Payloads de exemplo

| Arquivo                            | Origem                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `exemplos/player.json`             | Real, pós-update Ranked (com `leagueTier`, 54 achievements)                                   |
| `exemplos/player-legado-2023.json` | Real, pré-Ranked — tem `legendStatistics`, `playerHouse`, `townHallWeaponLevel`, heróis, pets |
| `exemplos/clan.json`               | Real (memberList truncada a 5)                                                                |
| `exemplos/currentwar.json`         | Real, `state: inWar`                                                                          |
| `exemplos/cwl-war.json`            | Real, guerra de CWL (mostra `warStartTime`)                                                   |
| `exemplos/cwl-leaguegroup.json`    | Real, grupo de CWL (mostra `warTags: ["#0"]`)                                                 |
| `exemplos/capitalraidseasons.json` | Real, nov/2025 (mostra `districts[].attacks[]`)                                               |
| `exemplos/warlog.json`             | Real                                                                                          |
| `exemplos/erros.json`              | Corpos reais de 400/403/404 + `notInWar` + `verifytoken` + `goldpass`                         |

---

## Resumo executivo

### O que a API OFERECE

- **Perfil de jogador completo**: TH, nível de arma da TH, XP, troféus, liga (novo `leagueTier`), nível de **cada** tropa/herói/feitiço/equipamento, 46–54 achievements cumulativos, `warPreference`, papel no clã, contribuição vitalícia à Capital, estatísticas de Lenda.
- **Perfil de clã**: descrição, requisitos, localização, idioma, labels, liga de guerra/capital, e `memberList` com os 50 membros (com doações, troféus e rank) **em uma única request**.
- **Guerra atual** com ataques individuais (atacante, defensor, estrelas, % e **duração em segundos**), CWL (grupo + cada guerra por `warTag`), e war log agregado.
- **Raids da Capital** dos últimos ~6 fins de semana, com participação por membro e — não documentado por wrappers — **cada ataque individual por distrito**.
- **Rankings** por país e globais (jogadores, clãs, builder base, capitais) e rankings finais de temporadas de Lenda.
- **Verificação de propriedade de conta** (`verifytoken`) — base para login sem senha.
- **Metadados**: locations, labels, ligas, temporada do Gold Pass.
- Todos os ícones/badges em CDN público sem autenticação.

### O que a API NÃO OFERECE

- Nenhum dado de **construções**: níveis de defesas, muralhas, armadilhas, layout.
- **Construtores**: quantidade, ocupação, O.T.T.O.
- **Timers** de upgrade (nem laboratório, nem herói, nem edifício).
- **Recursos em caixa**: ouro, elixir, elixir negro, gemas, medalhas.
- **Histórico**. A API é 100% _snapshot_. Não há série temporal, não há "há 30 dias".
- **Ataques individuais de guerras passadas** — somem quando a guerra rotaciona; o warlog só tem placar agregado e CWL nem isso.
- **Eventos** de clã (entrou/saiu/promoveu) e chat.
- **Webhooks / push**. Só polling.
- **Loot por batalha** (só via `battlelog`, que parece ser escopo restrito).
- **Último login** explícito.
- **CORS** — impossível chamar direto do navegador.
- Máximos por TH: `maxLevel` é global.

---

## As 10 descobertas mais relevantes para o produto

1. **`achievements[]` é um data warehouse cumulativo e vitalício.** Doações, saque de ouro/elixir/EN, ataques vencidos, estrelas de guerra, estrelas de CWL, pontos de Clan Games, pontos de temporada, ouro da Capital — tudo em contadores monotônicos que **nunca resetam**, ao contrário de `donations`/`attackWins`/`trophies`. Com 2 snapshots você tem **taxa de farm, ritmo de ataque e detecção de conta parada**.

2. **`Empire Builder` é o nível do Castelo do Clã, não do TH.** E `Bigger Coffers` é o maior Armazém de Ouro; `Master Engineering`, o Salão do Construtor. A API vaza níveis exatos de construções pelos achievements — correção direta à premissa (a).

3. **`cocproxy.royaleapi.dev` derruba a premissa (b).** IP fixo `45.79.218.79` na allowlist e a Vercel passa a chamar a API. Ainda assim: o ingestor próprio continua sendo necessário, por causa do histórico.

4. **Contribuição de guerra é auditável mesmo em clã com war log privado.** `/warlog` e `/currentwar` devolvem 403, mas os achievements `War Hero`, `War League Legend` e `Clan War Wealth` de cada membro continuam públicos em `/players/{tag}`. Diferencial competitivo direto.

5. **`capitalraidseasons` tem `districts[].attacks[]` com atacante identificado** — campo real no payload que **nenhum wrapper maduro tipa**. Permite medir eficiência de raid por jogador (ataques gastos × % destruída), não só o total saqueado.

6. **`currentwar` é uma janela que fecha.** Ataques individuais desaparecem quando a guerra rotaciona e são **irrecuperáveis**. Persistir `currentwar` durante `inWar`/`warEnded` é a decisão de arquitetura com maior valor de longo prazo — e precisa começar antes do lançamento.

7. **A API omite chaves em vez de mandar `null`.** `attacks` some quando o membro não atacou; `superTroopIsActive` só aparece quando ativo; `warTies`/`warLosses` só existem com log público; `townHallWeaponLevel` só a partir do TH12. Cada omissão é um **sinal semântico**, não um bug — e cada uma quebra um tipo ingênuo.

8. **`Cache-Control` revela a cadência real da API** e varia por endpoint (60 s para player, 120 s para guerra, 600 s para CWL). Polling mais rápido que isso é desperdício puro de quota. Erros são cacheados por **600 s** — inclusive os seus erros de debug.

9. **`legendStatistics.currentSeason` vem incompleto** (só `trophies`, sem `rank` nem `id`), enquanto `bestSeason`/`previousSeason` vêm completos. Tracking diário de Lenda **exige** snapshot próprio — a API não guarda a curva.

10. **`verifytoken` é a base de um produto com conta.** É o mecanismo oficial de prova de propriedade, permite login sem senha e separa "site de consulta" de "copiloto pessoal". Custa uma request e deve estar no MVP.

---

## Notas de metodologia

- O portal oficial (`developer.clashofclans.com/#/documentation`) é uma SPA; o Swagger UI (`/api-docs/index.html`) carrega a spec de uma URL guardada no cookie `game-api-url`, **acessível apenas após login**. A spec OpenAPI **não** é servida publicamente (todas as variações de `/swagger.json`, `/openapi.json` testadas em 2026-07 devolvem HTML ou 403).
- O que é marcado **OFICIAL** vem de: (a) respostas HTTP reais capturadas contra `api.clashofclans.com` e `developer.clashofclans.com` em 2026-07; (b) texto e regras de validação extraídos do bundle JS do portal (`bundle.b9674d.js`).
- O que é marcado **OBSERVADO** vem de payloads reais da comunidade (fixtures do `coc.py`, cliente R `clash`) e dos tipos do `clashofclans.js` v4.0.5 (mai/2026), que acompanha o update Ranked de out/2025.
- ⚠️ **NÃO CONFIRMADO** = inferido, precisa de chave real para validar. Os itens mais importantes nessa categoria: `battlelog`, `leaguehistory`, `/leaguegroup/{tag}/{season}`, e o suporte a CIDR em `cidrRanges`.
