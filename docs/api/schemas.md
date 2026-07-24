# Schemas — shape completo dos objetos de resposta

Legenda de origem: **OFICIAL** (Swagger/portal ou resposta HTTP real), **OBSERVADO** (payload real da comunidade), ⚠️ **NÃO CONFIRMADO**.
Legenda de obrigatoriedade: `req` = sempre presente; `opt` = pode não existir na resposta (**a API omite a chave inteira — não manda `null`**).

> **Regra de ouro:** a API do CoC **omite chaves** em vez de mandar `null`. Todo campo `opt` precisa de `?.` / default no TypeScript. Isso é a principal fonte de bug em wrappers ingênuos.

---

## Player — `GET /players/{tag}`

### Nível raiz

| Campo                      | Tipo                                      | Req              | Notas                                                                                                                                                                     |
| -------------------------- | ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tag`                      | `string`                                  | req              | com `#`                                                                                                                                                                   |
| `name`                     | `string`                                  | req              | pode conter emoji/UTF-8 e caracteres de "leetspeak"                                                                                                                       |
| `townHallLevel`            | `number`                                  | req              | 1..18 (TH18 desde 2026)                                                                                                                                                   |
| `townHallWeaponLevel`      | `number`                                  | **opt**          | **só existe a partir do TH12.** Ausente para TH ≤ 11. Nível da arma da TH (1..5+)                                                                                         |
| `expLevel`                 | `number`                                  | req              | nível de experiência da conta                                                                                                                                             |
| `trophies`                 | `number`                                  | req              | troféus da vila principal. **Pós-update Ranked pode vir `0`** para contas já migradas ao sistema de ligas — OBSERVADO em fixture 2026                                     |
| `bestTrophies`             | `number`                                  | req              | recorde histórico                                                                                                                                                         |
| `warStars`                 | `number`                                  | req              | estrelas totais de guerra (acumulado vitalício)                                                                                                                           |
| `attackWins`               | `number`                                  | req              | **reseta a cada temporada**                                                                                                                                               |
| `defenseWins`              | `number`                                  | req              | **reseta a cada temporada**                                                                                                                                               |
| `builderHallLevel`         | `number`                                  | **opt**          | ausente se BH nunca desbloqueada                                                                                                                                          |
| `builderBaseTrophies`      | `number`                                  | opt              |                                                                                                                                                                           |
| `bestBuilderBaseTrophies`  | `number`                                  | opt              |                                                                                                                                                                           |
| `donations`                | `number`                                  | req              | **reseta a cada temporada**                                                                                                                                               |
| `donationsReceived`        | `number`                                  | req              | **reseta a cada temporada**                                                                                                                                               |
| `clanCapitalContributions` | `number`                                  | req              | **acumulado vitalício** de Ouro da Capital contribuído                                                                                                                    |
| `role`                     | `'member'\|'admin'\|'coLeader'\|'leader'` | **opt**          | ausente se sem clã. **`admin` = "Ancião"/Elder na UI do jogo** — a API nunca usa a string `elder`                                                                         |
| `warPreference`            | `'in' \| 'out'`                           | **opt**          | ausente se sem clã. Sinal direto de "quero participar de guerra"                                                                                                          |
| `clan`                     | `PlayerClan`                              | opt              | `{ tag, name, clanLevel, badgeUrls }`                                                                                                                                     |
| `leagueTier`               | `LeagueTier`                              | req†             | **novo (out/2025)**. `{ id, name, iconUrls:{small,large} }`. Ex.: `{"id":105000002,"name":"Skeleton League 2"}`                                                           |
| `league`                   | `League`                                  | **opt / legado** | `{ id, name, iconUrls:{small,tiny,medium?} }`. Pré-Ranked. **Ainda aparece dentro de `memberList`** (ver abaixo) mas foi removido da raiz de `/players` nos payloads 2026 |
| `builderBaseLeague`        | `{ id, name }`                            | opt              | **sem `iconUrls`**                                                                                                                                                        |
| `legendStatistics`         | `LegendStatistics`                        | **opt**          | ausente se o jogador nunca esteve em Lenda                                                                                                                                |
| `currentLeagueGroupTag`    | `string`                                  | ⚠️               | Tipado em `clashofclans.js` v4 mas **ausente** no fixture real que capturamos. Tratar como `opt`                                                                          |
| `currentLeagueSeasonId`    | `number`                                  | ⚠️               | idem                                                                                                                                                                      |
| `previousLeagueGroupTag`   | `string`                                  | ⚠️               | idem                                                                                                                                                                      |
| `previousLeagueSeasonId`   | `number`                                  | ⚠️               | idem                                                                                                                                                                      |
| `achievements`             | `Achievement[]`                           | req              | 46–54 itens (cresce a cada update do jogo)                                                                                                                                |
| `labels`                   | `Label[]`                                 | req              | array vazio `[]` se nenhum (aqui **não** omite)                                                                                                                           |
| `troops`                   | `PlayerItem[]`                            | req              | tropas + **pets** + **máquinas de cerco** + tropas da Builder Base, tudo misturado                                                                                        |
| `heroes`                   | `PlayerItem[]`                            | req              | `[]` para TH < 7                                                                                                                                                          |
| `heroEquipment`            | `PlayerItem[]`                            | req              | **top-level, desde 2024**. `[]` se nenhum equipamento                                                                                                                     |
| `spells`                   | `PlayerItem[]`                            | req              |                                                                                                                                                                           |
| `playerHouse`              | `PlayerHouse`                             | **opt**          | Casa do jogador na Capital                                                                                                                                                |

† `leagueTier` sempre presente em payloads pós-out/2025; jogadores sem liga recebem o tier "Unranked".

### `LegendStatistics` (opt)

| Campo                       | Tipo     | Req | Notas                                                                   |
| --------------------------- | -------- | --- | ----------------------------------------------------------------------- |
| `legendTrophies`            | `number` | req | troféus de Lenda acumulados **vitalícios**                              |
| `currentSeason`             | `Season` | opt | **⚠️ vem incompleto: só `trophies`, sem `id` e sem `rank`** (OBSERVADO) |
| `bestSeason`                | `Season` | opt | `{ id: "2021-01", rank: 412784, trophies: 5105 }` — completo            |
| `previousSeason`            | `Season` | opt | completo                                                                |
| `bestBuilderBaseSeason`     | `Season` | opt |                                                                         |
| `previousBuilderBaseSeason` | `Season` | opt |                                                                         |

`Season` = `{ id?: string /* "YYYY-MM" */, rank?: number, trophies: number }`.
**Não tipe `id`/`rank` como obrigatórios** — `currentSeason` quebra isso.

### `Achievement`

| Campo            | Tipo                                       | Req | Notas                                                                                                                                              |
| ---------------- | ------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`           | `string`                                   | req | **chave de negócio.** Estável em inglês independente da localização                                                                                |
| `stars`          | `0\|1\|2\|3`                               | req |                                                                                                                                                    |
| `value`          | `number`                                   | req | **contador cumulativo, monotônico crescente** — nunca reseta                                                                                       |
| `target`         | `number`                                   | req | alvo da próxima estrela; muda conforme `stars` sobe                                                                                                |
| `info`           | `string`                                   | req | descrição do alvo atual                                                                                                                            |
| `completionInfo` | `string \| null`                           | req | **`null` explícito** (única exceção à regra "omite em vez de null"). Quando preenchido, contém o valor legível: `"Highest Gold Storage level: 11"` |
| `village`        | `'home' \| 'builderBase' \| 'clanCapital'` | req | **`clanCapital` existe e não está tipado em `clashofclans.js`** (OBSERVADO)                                                                        |

⚠️ Existem **dois achievements com o mesmo `name`**: `"Keep Your Account Safe!"` (um de rede social, outro de Supercell ID). **Não use `name` como chave primária de um `Map`** sem desambiguar por `info`.

### `PlayerItem` (troops / heroes / spells / heroEquipment)

| Campo                | Tipo                      | Req     | Notas                                                                                                                                                                 |
| -------------------- | ------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`               | `string`                  | req     | em inglês                                                                                                                                                             |
| `level`              | `number`                  | req     |                                                                                                                                                                       |
| `maxLevel`           | `number`                  | req     | **máximo GLOBAL do jogo, não do TH atual** — confirmado (ver abaixo)                                                                                                  |
| `village`            | `'home' \| 'builderBase'` | req     |                                                                                                                                                                       |
| `superTroopIsActive` | `boolean`                 | **opt** | **só aparece na tropa quando o Super Troop está ativo**. A chave é omitida quando inativo — testar `=== true`, não `!== undefined`                                    |
| `equipment`          | `PlayerItem[]`            | **opt** | **dentro de `heroes[]`**: os equipamentos _atualmente equipados_ naquele herói. Distinto de `heroEquipment` top-level (que lista **todos** os equipamentos possuídos) |

#### Confirmação de `maxLevel` (OBSERVADO, prova direta)

Fixture real de um jogador **TH8**:

```json
{ "name": "Barbarian", "level": 5, "maxLevel": 12 }
```

No TH8 o Bárbaro trava no nível 5. `maxLevel: 12` é o teto global do jogo. **Premissa (c) do projeto está CORRETA.**
Consequência: para saber "o que dá para subir agora" o ClashPilot **precisa de tabela estática própria** de `maxLevel por TH` (fontes: `clashofclans.js/src/util/raw.json`, `clash-of-clans-data`, wiki).

### `PlayerHouse` (opt)

```json
{
  "elements": [
    { "type": "ground", "id": 82000000 },
    { "type": "walls", "id": 82000048 },
    { "type": "roof", "id": 82000011 },
    { "type": "decoration", "id": 82000058 }
  ]
}
```

`type` ∈ `ground` | `walls` | `roof` | `decoration` (OBSERVADO; pode haver mais). Puramente cosmético.

---

## Clan — `GET /clans/{tag}`

| Campo                         | Tipo                             | Req     | Notas                                                                         |
| ----------------------------- | -------------------------------- | ------- | ----------------------------------------------------------------------------- |
| `tag`, `name`                 | `string`                         | req     |                                                                               |
| `type`                        | `'open'\|'inviteOnly'\|'closed'` | req     |                                                                               |
| `description`                 | `string`                         | req     |                                                                               |
| `location`                    | `Location`                       | **opt** | ausente se o clã não definiu                                                  |
| `chatLanguage`                | `{ id, name, languageCode }`     | **opt** | ex.: `{"id":75000000,"name":"English","languageCode":"EN"}`                   |
| `badgeUrls`                   | `{ small, medium, large }`       | req     |                                                                               |
| `clanLevel`                   | `number`                         | req     |                                                                               |
| `clanPoints`                  | `number`                         | req     |                                                                               |
| `clanBuilderBasePoints`       | `number`                         | req     |                                                                               |
| `clanCapitalPoints`           | `number`                         | req     |                                                                               |
| `capitalLeague`               | `{ id, name }`                   | opt     |                                                                               |
| `requiredTrophies`            | `number`                         | req     |                                                                               |
| `requiredTownhallLevel`       | `number`                         | **opt** | note o `h` minúsculo em `townhall` — inconsistente com `townHallLevel`        |
| `requiredBuilderBaseTrophies` | `number`                         | opt     |                                                                               |
| `warFrequency`                | enum                             | opt     |                                                                               |
| `warWinStreak`                | `number`                         | req     |                                                                               |
| `warWins`                     | `number`                         | req     |                                                                               |
| `warTies`                     | `number`                         | **opt** | **só existe se o war log for público**                                        |
| `warLosses`                   | `number`                         | **opt** | **só existe se o war log for público** — ótimo detector barato de log privado |
| `isWarLogPublic`              | `boolean`                        | req     |                                                                               |
| `warLeague`                   | `{ id, name }`                   | opt     |                                                                               |
| `members`                     | `number`                         | req     | contagem                                                                      |
| `memberList`                  | `ClanMember[]`                   | req†    | †**ausente em `/clans` (busca)**                                              |
| `clanCapital`                 | `ClanCapital`                    | req†    | †**ausente em `/clans` (busca)**                                              |
| `labels`                      | `Label[]`                        | req     |                                                                               |
| `isFamilyFriendly`            | `boolean`                        | req     |                                                                               |

### `ClanMember`

| Campo                 | Tipo                                      | Req              | Notas                                                                                                                                                 |
| --------------------- | ----------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tag`, `name`         | `string`                                  | req              |                                                                                                                                                       |
| `role`                | `'member'\|'admin'\|'coLeader'\|'leader'` | req              | `admin` = Ancião                                                                                                                                      |
| `townHallLevel`       | `number`                                  | req              |                                                                                                                                                       |
| `expLevel`            | `number`                                  | req              |                                                                                                                                                       |
| `leagueTier`          | `LeagueTier`                              | req              | novo                                                                                                                                                  |
| `league`              | `League`                                  | **opt / legado** | **OBSERVADO: `memberList` ainda traz `league` E `leagueTier` lado a lado** — `clashofclans.js` não tipa `league` aqui. Útil para retrocompatibilidade |
| `builderBaseLeague`   | `{ id, name }`                            | opt              |                                                                                                                                                       |
| `trophies`            | `number`                                  | req              |                                                                                                                                                       |
| `builderBaseTrophies` | `number`                                  | opt              |                                                                                                                                                       |
| `clanRank`            | `number`                                  | req              | posição atual no clã                                                                                                                                  |
| `previousClanRank`    | `number`                                  | req              | **delta `previousClanRank - clanRank` é um sinal de atividade grátis**                                                                                |
| `donations`           | `number`                                  | req              | reseta na temporada                                                                                                                                   |
| `donationsReceived`   | `number`                                  | req              | reseta na temporada                                                                                                                                   |
| `playerHouse`         | `PlayerHouse`                             | opt              |                                                                                                                                                       |

**⚠️ O que `memberList` NÃO tem:** heróis, tropas, `warPreference`, `attackWins`, `warStars`, `clanCapitalContributions`, `achievements`. Para qualquer análise de progresso individual é obrigatório 1 chamada `/players/{tag}` **por membro** (até 50 chamadas por clã).

### `ClanCapital`

```json
{ "capitalHallLevel": 10,
  "districts": [ { "id": 70000000, "name": "Capital Peak", "districtHallLevel": 10 }, ... ] }
```

Ambos os campos são `opt` (clã sem Capital desbloqueada não traz `districts`).
IDs de distrito são estáveis: `70000000` Capital Peak, `70000001` Barbarian Camp, `70000002` Wizard Valley, `70000003` Balloon Lagoon, `70000004` Builder's Workshop, `70000005` Dragon Cliffs, `70000006` Golem Quarry, `70000007` Skeleton Park, `70000008` Goblin Mines.

---

## ClanWar — `GET /clans/{tag}/currentwar` e `/clanwarleagues/wars/{warTag}`

| Campo                  | Tipo                                             | Req     | Notas                                                                                |
| ---------------------- | ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------ |
| `state`                | `'notInWar'\|'preparation'\|'inWar'\|'warEnded'` | req     |                                                                                      |
| `teamSize`             | `number`                                         | opt†    | †**ausente quando `notInWar`**                                                       |
| `attacksPerMember`     | `number`                                         | **opt** | **ausente em CWL** (é sempre 1). Presente em guerra normal (1 ou 2)                  |
| `battleModifier`       | `'none' \| 'hardMode'`                           | **opt** | Hard Mode war (2025+). Ausente em guerras antigas                                    |
| `preparationStartTime` | `string`                                         | opt†    |                                                                                      |
| `startTime`            | `string`                                         | opt†    |                                                                                      |
| `endTime`              | `string`                                         | opt†    |                                                                                      |
| `warStartTime`         | `string`                                         | **opt** | **só em `/clanwarleagues/wars/{warTag}`** (OBSERVADO, não tipado por nenhum wrapper) |
| `clan`                 | `WarClan`                                        | req     | **zerado e sem `tag`/`name`/`members` quando `notInWar`**                            |
| `opponent`             | `WarClan`                                        | req     | idem                                                                                 |

### `WarClan`

| Campo                   | Tipo                   | Req                                    |
| ----------------------- | ---------------------- | -------------------------------------- |
| `tag`, `name`           | `string`               | opt† (ausentes em `notInWar`)          |
| `badgeUrls`             | `{small,medium,large}` | req                                    |
| `clanLevel`             | `number`               | req                                    |
| `attacks`               | `number`               | req — total de ataques feitos pelo clã |
| `stars`                 | `number`               | req                                    |
| `destructionPercentage` | `number`               | req — **float**, ex. `93.62222`        |
| `members`               | `ClanWarMember[]`      | opt†                                   |
| `expEarned`             | `number`               | **só no warlog**                       |

### `ClanWarMember`

| Campo                | Tipo              | Req     | Notas                                                                                                                                       |
| -------------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `tag`, `name`        | `string`          | req     |                                                                                                                                             |
| `townhallLevel`      | `number`          | req     | **`h` minúsculo aqui** (`townhallLevel`), diferente de `townHallLevel` no player/clan. Erro de digitação da própria API — cuidado ao mapear |
| `mapPosition`        | `number`          | req     | **posição no mapa de guerra, 1..teamSize.** ⚠️ Não corresponde à ordem real do mapa em CWL; use ordenação por `mapPosition` mesmo assim     |
| `opponentAttacks`    | `number`          | req     | quantas vezes **este membro foi atacado**                                                                                                   |
| `bestOpponentAttack` | `ClanWarAttack`   | **opt** | melhor ataque sofrido. Ausente se nunca atacado                                                                                             |
| `attacks`            | `ClanWarAttack[]` | **opt** | **a chave inteira some se o membro não atacou** — este é o detector canônico de "não usou ataque"                                           |

### `ClanWarAttack`

| Campo                   | Tipo     | Notas                                                                                                            |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `order`                 | `number` | ordem global do ataque na guerra — **permite reconstruir a linha do tempo** e inferir o horário aproximado       |
| `attackerTag`           | `string` |                                                                                                                  |
| `defenderTag`           | `string` |                                                                                                                  |
| `stars`                 | `0..3`   |                                                                                                                  |
| `destructionPercentage` | `number` | int no `currentwar` (ex. `94`)                                                                                   |
| `duration`              | `number` | **segundos de duração do ataque** — campo subutilizado; `duration` alto + poucas estrelas = ataque mal executado |

---

## ClanWarLog — `GET /clans/{tag}/warlog`

| Campo              | Tipo                         | Req | Notas                                                                                                       |
| ------------------ | ---------------------------- | --- | ----------------------------------------------------------------------------------------------------------- |
| `result`           | `'win'\|'lose'\|'tie'\|null` | opt | **`null` para guerras de CWL** — CWL aparece no warlog com `result: null` e `opponent` **sem `tag`/`name`** |
| `endTime`          | `string`                     | req |                                                                                                             |
| `teamSize`         | `number`                     | req |                                                                                                             |
| `attacksPerMember` | `number`                     | opt |                                                                                                             |
| `battleModifier`   | `'none'\|'hardMode'`         | opt |                                                                                                             |
| `clan`             | `WarLogClan`                 | req | inclui `expEarned`                                                                                          |
| `opponent`         | `WarLogClan`                 | req | em CWL vem só com `badgeUrls`, `clanLevel`, `stars`, `destructionPercentage`                                |

**O warlog NÃO tem lista de membros nem ataques individuais.** Só o placar agregado. Histórico por jogador exige capturar `currentwar` **antes de a guerra sair do ar**.

---

## ClanWarLeagueGroup — `/clans/{tag}/currentwar/leaguegroup`

| Campo    | Tipo                                                                             | Notas                                                 |
| -------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `state`  | `'notInWar'\|'preparation'\|'inWar'\|'ended'`                                    | note: `ended`, não `warEnded`                         |
| `season` | `string`                                                                         | `"2023-06"`                                           |
| `clans`  | `{ tag, name, clanLevel, badgeUrls, members: { tag, name, townHallLevel }[] }[]` | 8 clãs; `members` é o **roster de CWL** (só 3 campos) |
| `rounds` | `{ warTags: string[] }[]`                                                        | 7 rodadas × 4 warTags. `"#0"` = ainda não sorteada    |

---

## CapitalRaidSeason — `/clans/{tag}/capitalraidseasons`

| Campo                                 | Tipo                   | Notas                                                       |
| ------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `state`                               | `'ongoing' \| 'ended'` |                                                             |
| `startTime` / `endTime`               | `string`               |                                                             |
| `capitalTotalLoot`                    | `number`               | Ouro da Capital saqueado pelo clã no fim de semana          |
| `raidsCompleted`                      | `number`               | clãs adversários totalmente destruídos                      |
| `totalAttacks`                        | `number`               |                                                             |
| `enemyDistrictsDestroyed`             | `number`               |                                                             |
| `offensiveReward` / `defensiveReward` | `number`               | Medalhas de Raid por membro                                 |
| `members`                             | `RaidMember[]`         | **opt — ausente na temporada `ongoing` em alguns casos** ⚠️ |
| `attackLog`                           | `AttackLogEntry[]`     |                                                             |
| `defenseLog`                          | `DefenseLogEntry[]`    |                                                             |

### `RaidMember`

```json
{
  "tag": "#280GCCGYV",
  "name": "ItzSmokes",
  "attacks": 6,
  "attackLimit": 5,
  "bonusAttackLimit": 1,
  "capitalResourcesLooted": 22274
}
```

**Participação total = `attackLimit + bonusAttackLimit`.** No exemplo: 5+1=6, usou 6 → 100%.
**Membros que não atacaram simplesmente não aparecem em `members[]`** — é preciso cruzar com `memberList` do clã para achar os ausentes.

### `AttackLogEntry` / `DefenseLogEntry`

| Campo                   | Tipo                              |
| ----------------------- | --------------------------------- |
| `defender` / `attacker` | `{ tag, name, level, badgeUrls }` |
| `attackCount`           | `number`                          |
| `districtCount`         | `number`                          |
| `districtsDestroyed`    | `number`                          |
| `districts`             | `RaidDistrict[]`                  |

### `RaidDistrict` — **campos não documentados por wrappers**

```json
{
  "id": 70000001,
  "name": "Barbarian Camp",
  "districtHallLevel": 5,
  "destructionPercent": 100,
  "stars": 3,
  "attackCount": 3,
  "totalLooted": 11442,
  "attacks": [
    {
      "attacker": { "tag": "#280GCCGYV", "name": "ItzSmokes" },
      "destructionPercent": 100,
      "stars": 3
    },
    {
      "attacker": { "tag": "#280GCCGYV", "name": "ItzSmokes" },
      "destructionPercent": 55,
      "stars": 1
    },
    {
      "attacker": { "tag": "#280GCCGYV", "name": "ItzSmokes" },
      "destructionPercent": 40,
      "stars": 0
    }
  ]
}
```

**Achado importante:** `districts[].stars` e `districts[].attacks[]` **existem no payload real e NÃO estão tipados no `clashofclans.js`**.
Isso significa **granularidade por-ataque-por-distrito**, com atacante identificado — dá para computar eficiência individual de raid (ataques usados vs. % destruída), não só o total saqueado.
`attacks[]` é `opt` (ausente em distritos com `attackCount: 0`) e o `destructionPercent` é **cumulativo por ataque** (não incremental).

---

## Rankings

| Objeto                     | Campos                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerRanking`            | `tag`, `name`, `expLevel`, `trophies`, `attackWins`, `defenseWins`, `rank`, `previousRank`, `clan?` (**sem `clanLevel`**), `league?`/`leagueTier?` |
| `ClanRanking`              | `tag`, `name`, `clanLevel`, `clanPoints`, `location`, `members`, `rank`, `previousRank`, `badgeUrls`                                               |
| `ClanBuilderBaseRanking`   | idem, com `clanBuilderBasePoints` (sem `clanPoints`)                                                                                               |
| `PlayerBuilderBaseRanking` | `tag`, `name`, `expLevel`, `builderBaseTrophies`, `rank`, `previousRank`, `clan?`, `builderBaseLeague?`                                            |
| `ClanCapitalRanking`       | `tag`, `name`, `clanLevel`, `clanPoints`, `clanCapitalPoints`, `location`, `members`, `rank`, `previousRank`, `badgeUrls`                          |

---

## Objetos auxiliares

```ts
type Badge = { small: string; medium: string; large: string }; // sempre os 3
type Icon = { small: string; tiny?: string; medium?: string }; // labels não têm tiny
type LeagueTierIcon = { small: string; large: string }; // sem medium/tiny
type Label = { id: number; name: string; iconUrls: Icon };
type Location = {
  id: number;
  name: string;
  isCountry: boolean;
  countryCode?: string;
  localizedName?: string;
};
```

Todos os assets são servidos por `https://api-assets.clashofclans.com/...` — **sem autenticação**, podem ser usados direto no `<img>` do front (e cacheados pelo CDN da Vercel).
