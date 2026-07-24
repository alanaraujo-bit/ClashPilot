# Endpoints — Clash of Clans API v1

**Base URL:** `https://api.clashofclans.com/v1`
**Auth:** `Authorization: Bearer <JWT>` em toda requisição (ver [limites-e-erros.md](./limites-e-erros.md))
**Content-Type das respostas:** `application/json; charset=utf-8`

## Convenções

| Símbolo               | Significado                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **OFICIAL**           | Confirmado no portal/Swagger da Supercell ou em resposta HTTP real capturada                                        |
| **OBSERVADO**         | Confirmado em payloads reais da comunidade (fixtures do `coc.py`, wrappers maduros) mas não descrito na doc oficial |
| ⚠️ **NÃO CONFIRMADO** | Inferido; precisa de validação com chave real                                                                       |

### Codificação de tags

Tags de jogador/clã/guerra começam com `#`. **Sempre** faça percent-encoding: `#2PP` → `%232PP`.
Erro clássico: usar `#` cru gera fragment de URL e a request chega sem a tag.
Boa prática (usada por todos os wrappers): normalizar antes de codificar — uppercase, trocar `O` por `0`, remover espaços.

### Paginação (OFICIAL)

Endpoints de lista aceitam:

| Param    | Tipo   | Descrição                          |
| -------- | ------ | ---------------------------------- |
| `limit`  | int    | Nº de itens retornados             |
| `after`  | string | Retorna itens após este marcador   |
| `before` | string | Retorna itens antes deste marcador |

`after` e `before` são **mutuamente exclusivos** — enviar os dois gera `400 badRequest`.
A resposta traz:

```json
{ "items": [/* ... */], "paging": { "cursors": { "after": "eyJwb3MiOjEwfQ" } } }
```

**OBSERVADO (importante):** quando não há mais páginas, `paging.cursors` vem como **objeto vazio `{}`** — não `null`, não ausente. Todos os fixtures reais que capturamos de `/clans/{tag}/warlog`, `/clans?name=`, e `/clans/{tag}/capitalraidseasons` têm `"paging": {"cursors": {}}`. Condição de parada correta: `!paging?.cursors?.after`.

⚠️ **NÃO CONFIRMADO:** os cursores são base64 de `{"pos":N}`. Não dependa desse formato — trate como opaco.

---

## 1. Clãs

### `GET /clans` — busca de clãs

Todos os filtros de busca (OFICIAL, do Swagger + wrappers):

| Param                        | Tipo   | Regras                                                                                    |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `name`                       | string | Mínimo **3 caracteres**. Busca _wildcard_ — casa em qualquer posição do nome.             |
| `warFrequency`               | enum   | `always`, `moreThanOncePerWeek`, `oncePerWeek`, `lessThanOncePerWeek`, `never`, `unknown` |
| `locationId`                 | int    | Ver `/locations`                                                                          |
| `minMembers`                 | int    |                                                                                           |
| `maxMembers`                 | int    |                                                                                           |
| `minClanPoints`              | int    |                                                                                           |
| `minClanLevel`               | int    |                                                                                           |
| `labelIds`                   | string | Lista de IDs separada por vírgula (ver `/labels/clans`)                                   |
| `limit` / `after` / `before` |        | paginação                                                                                 |

**Regra OFICIAL:** é obrigatório informar **pelo menos um** filtro além da paginação; `GET /clans?limit=10` sozinho retorna `400 badRequest`.

Resposta: `items[]` de objetos `Clan` **sem** `memberList` e **sem** `clanCapital` (OBSERVADO em fixture real de 1,2 MB — as chaves simplesmente não aparecem).

`Cache-Control` observado: `max-age=60`.

### `GET /clans/{clanTag}`

Perfil completo do clã, incluindo `memberList` (até 50) e `clanCapital`.
`Cache-Control` observado: `max-age=91` (valor **variável**, tipicamente 60–120 — não hardcode).

Exemplo: [`exemplos/clan.json`](./exemplos/clan.json)

### `GET /clans/{clanTag}/members`

Params: `limit`, `after`, `before`.
Mesmo objeto `ClanMember` do `memberList`.
`Cache-Control` observado: `max-age=120`.

### `GET /clans/{clanTag}/warlog`

Params: `limit`, `after`, `before`.
**Falha com `403` se `isWarLogPublic === false`.** O corpo do erro é `{"reason": "accessDenied"}` — **sem campo `message`** (OBSERVADO; é assim que os wrappers detectam "war log privado" e o traduzem para o pseudo-reason `privateWarLog`).

`Cache-Control` observado: `max-age=120`.
Exemplo: [`exemplos/warlog.json`](./exemplos/warlog.json)

### `GET /clans/{clanTag}/currentwar`

Sem params. Estados: `notInWar`, `preparation`, `inWar`, `warEnded`.

**Armadilha (OBSERVADO):** quando `state === "notInWar"`, o payload **ainda retorna `clan` e `opponent`**, mas zerados e sem `tag`/`name`/`members` — só `badgeUrls` (badge genérico), `clanLevel: 0`, `attacks: 0`, `stars: 0`, `destructionPercentage: 0`. Também não há `teamSize`, `startTime`, `endTime`. Não assuma que `clan.tag` existe.

Também `403 accessDenied` sem `message` quando o war log é privado **e** o clã está em CWL — ⚠️ NÃO CONFIRMADO se `currentwar` respeita a flag `isWarLogPublic` em guerra normal (a maioria dos relatos diz que **sim**, currentwar é bloqueado junto com o warlog).

`Cache-Control` observado: `max-age=120`.
Exemplo: [`exemplos/currentwar.json`](./exemplos/currentwar.json)

### `GET /clans/{clanTag}/currentwar/leaguegroup`

Grupo de CWL do mês. Retorna `state`, `season` (`"2023-06"`), `clans[8]` e `rounds[7]`.

**OBSERVADO:** rodadas ainda não sorteadas vêm com `warTags: ["#0","#0","#0","#0"]`. Filtre `#0` antes de chamar `/clanwarleagues/wars/{warTag}`.
`404 notFound` quando o clã não está em CWL.

`Cache-Control` observado: `max-age=600`.
Exemplo: [`exemplos/cwl-leaguegroup.json`](./exemplos/cwl-leaguegroup.json)

### `GET /clanwarleagues/wars/{warTag}`

Uma guerra individual de CWL. Mesmo shape de `currentwar`, **com duas diferenças OBSERVADAS**:

- **não tem** `attacksPerMember` (CWL é sempre 1 ataque/membro);
- **tem** `warStartTime` — campo extra que não existe em `currentwar` e que **nenhum wrapper tipa**. Aparece junto de `startTime`.

`Cache-Control` observado: `max-age=600`.
Exemplo: [`exemplos/cwl-war.json`](./exemplos/cwl-war.json)

### `GET /clans/{clanTag}/capitalraidseasons`

Params: `limit`, `after`, `before`. Retorna fins de semana de Raid (mais recente primeiro).
`Cache-Control` observado: `max-age=120`.
Exemplo: [`exemplos/capitalraidseasons.json`](./exemplos/capitalraidseasons.json)

---

## 2. Jogadores

### `GET /players/{playerTag}`

O endpoint mais rico da API. `Cache-Control` observado: `max-age=60`.
Exemplo: [`exemplos/player.json`](./exemplos/player.json)

### `POST /players/{playerTag}/verifytoken`

Único endpoint `POST` da API. Verifica o token que o jogador gera em _Configurações → Mais Configurações → API Token_ dentro do jogo. É o mecanismo **oficial** de prova de propriedade de conta.

```http
POST /v1/players/%232PP/verifytoken
Content-Type: application/json

{ "token": "abc123..." }
```

Resposta (`200` mesmo quando inválido):

```json
{ "tag": "#2PP", "token": "TOKEN", "status": "ok" }
```

`status` ∈ `ok` | `invalid`. `Cache-Control` observado: `public max-age=600`.

### `GET /players/{playerTag}/battlelog` — ⚠️ NÃO CONFIRMADO / restrito

Presente em `clashofclans.js` ≥ 3.5 (out/2025). Retorna `items[]` com `battleType` (`legend` | `homeVillage` | `ranked`), `attack` (bool), `armyShareCode`, `opponentPlayerTag`, `stars`, `destructionPercentage`, `lootedResources[]`, `extraLootedResources[]`, `availableLoot[]`.

**Fortemente relatado como escopo privilegiado** (`allowedScopes` da conta de dev) — chaves comuns tendem a receber `403`. Trate como _não disponível_ no planejamento do ClashPilot até validar com chave real. Se disponível, é a única fonte de **loot por ataque**.

### `GET /players/{playerTag}/leaguehistory` — ⚠️ NÃO CONFIRMADO (novo, Ranked)

`items[]` com `leagueSeasonId`, `leagueTrophies`, `leagueTierId`, `placement`, `attackWins`, `attackLosses`, `attackStars`, `defenseWins`, `defenseLosses`, `defenseStars`, `maxBattles`.

### `GET /leaguegroup/{leagueGroupTag}/{seasonId}` — ⚠️ NÃO CONFIRMADO (novo, Ranked)

Param opcional: `playerTag`.
Retorna `members[]` (com `leagueTrophies`, `attackWinCount`, `attackLoseCount`, `defenseWinCount`, `defenseLoseCount`), `attackLogs[]` e `defenseLogs[]` (com `opponentPlayerTag`, `stars`, `destructionPercentage`, `trophies`, `creationTime`).

As tags/IDs vêm dos campos `currentLeagueGroupTag`, `currentLeagueSeasonId`, `previousLeagueGroupTag`, `previousLeagueSeasonId` de `/players/{tag}`.

---

## 3. Ligas

| Endpoint                                     | Observação                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /leaguetiers`                           | **Novo (out/2025, update Ranked).** Substitui `/leagues`. `limit`/`after`/`before`.                              |
| `GET /leaguetiers/{leagueId}`                | Tier individual (`id`, `name`, `iconUrls.small`, `iconUrls.large`)                                               |
| `GET /leagues`                               | ⚠️ Legado. Ainda responde, mas o objeto `league` está sendo substituído por `leagueTier`.                        |
| `GET /leagues/{leagueId}`                    | ⚠️ Legado                                                                                                        |
| `GET /leagues/{leagueId}/seasons`            | Só funciona para a **Legend League** (`id 29000022`). Retorna `items: [{ "id": "2015-07" }, ...]`                |
| `GET /leagues/{leagueId}/seasons/{seasonId}` | Ranking final de uma temporada de Lenda. Itens = `PlayerRanking` **sem** `leagueTier`. `limit`/`after`/`before`. |
| `GET /warleagues`                            | Ligas de guerra de clã (`id`, `name`)                                                                            |
| `GET /warleagues/{leagueId}`                 |                                                                                                                  |
| `GET /builderbaseleagues`                    |                                                                                                                  |
| `GET /builderbaseleagues/{leagueId}`         |                                                                                                                  |
| `GET /capitalleagues`                        |                                                                                                                  |
| `GET /capitalleagues/{leagueId}`             |                                                                                                                  |

---

## 4. Localizações e rankings

| Endpoint                                                    | Retorna                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| `GET /locations`                                            | `items[]` de `Location`                     |
| `GET /locations/{locationId}`                               | `Location`                                  |
| `GET /locations/{locationId}/rankings/clans`                | `ClanRanking[]` (troféus da vila principal) |
| `GET /locations/{locationId}/rankings/players`              | `PlayerRanking[]`                           |
| `GET /locations/{locationId}/rankings/clans-builder-base`   | `ClanBuilderBaseRanking[]`                  |
| `GET /locations/{locationId}/rankings/players-builder-base` | `PlayerBuilderBaseRanking[]`                |
| `GET /locations/{locationId}/rankings/capitals`             | `ClanCapitalRanking[]`                      |

Todos aceitam `limit`, `after`, `before`. `Cache-Control` observado: `max-age=60`.

**Ranking global (OBSERVADO):** use `locationId = global` (string literal) — `/locations/global/rankings/players`. `locationId` inválido devolve `400`:
`{"reason":"badRequest","message":"Unknown value for parameter locationId"}`.

`Location` traz `id`, `name`, `isCountry` e, quando `isCountry`, `countryCode` (ISO-2). `localizedName` é opcional e raramente vem preenchido.

---

## 5. Labels

| Endpoint              | Retorna              |
| --------------------- | -------------------- |
| `GET /labels/players` | `items[]` de `Label` |
| `GET /labels/clans`   | `items[]` de `Label` |

`Label` = `{ id, name, iconUrls: { small, medium } }`. **`iconUrls.tiny` não existe para labels** (só para ícones de liga legados).
Dados praticamente imutáveis — cachear por dias.

---

## 6. Gold Pass

### `GET /goldpass/seasons/current`

```json
{ "startTime": "20230601T080100.000Z", "endTime": "20230701T080000.000Z" }
```

`Cache-Control` observado: `max-age=60`. É a forma **oficial** de saber os limites da temporada atual (útil para fechar janelas de agregação de `donations`, `attackWins`, etc., que resetam no início da temporada).

---

## Tabela-resumo de cache observado

| Endpoint                              | `Cache-Control` (real, capturado)                |
| ------------------------------------- | ------------------------------------------------ |
| `/players/{tag}`                      | `max-age=60`                                     |
| `/clans/{tag}`                        | `max-age=60..120` (variável; visto `max-age=91`) |
| `/clans` (busca)                      | `max-age=60`                                     |
| `/clans/{tag}/members`                | `max-age=120`                                    |
| `/clans/{tag}/warlog`                 | `max-age=120`                                    |
| `/clans/{tag}/currentwar`             | `max-age=120`                                    |
| `/clans/{tag}/currentwar/leaguegroup` | `max-age=600`                                    |
| `/clanwarleagues/wars/{warTag}`       | `max-age=600`                                    |
| `/clans/{tag}/capitalraidseasons`     | `max-age=120`                                    |
| `/locations/*/rankings/*`             | `max-age=60`                                     |
| `/goldpass/seasons/current`           | `max-age=60`                                     |
| `/players/{tag}/verifytoken`          | `public max-age=600`                             |
| Respostas de erro (`400`/`403`/`404`) | `public max-age=600`                             |

**Consequência de produto:** `max-age` é a taxa real de atualização do dado no CDN da Supercell. Poll de `/players/{tag}` mais rápido que 60 s é desperdício de quota — devolve byte-a-byte a mesma resposta.

---

## Formato de data (OBSERVADO em 100% dos payloads)

`YYYYMMDD'T'HHMMSS.mmm'Z'` — ex.: `20251114T070000.000Z`.
**Não é ISO-8601 válido** (faltam os hífens e os dois-pontos). `new Date(s)` no JS retorna `Invalid Date`. É obrigatório normalizar:

```ts
const toDate = (s: string) =>
  new Date(s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6"));
```

Já `season`/`seasonId` usa `YYYY-MM` (`"2023-06"`).
