# Estudo da API oficial do Clash of Clans

Base URL: `https://api.clashofclans.com/v1`
Portal de chaves: `https://developer.clashofclans.com`
Auth: `Authorization: Bearer <JWT>`

---

## 1. Regras de acesso

| Regra            | Detalhe                                                                       | Impacto                                                 |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Chave presa a IP | até 10 chaves/conta, **até 5 CIDRs por chave** (`maxCidrs` do portal)         | exige gateway com IP fixo — ver ADR-001                 |
| Rate limit       | não publicado; wrappers maduros operam a 10–30 req/s, sem header de medição   | token bucket no gateway em **10 req/s**, fila e backoff |
| Cache-Control    | a própria API devolve `cache-control: max-age=60` (player) / `600` (rankings) | respeitar como piso do TTL                              |
| Tags             | `#` deve ser URL-encoded como `%23`                                           | normalizador central obrigatório                        |
| Manutenção       | durante manutenção do jogo retorna `503 inMaintenance`                        | circuit breaker + banner no app                         |

### Códigos de erro relevantes

`400 badRequest` · `403 accessDenied` / `accessDenied.invalidIp` · `404 notFound` ·
`429 requestThrottled` · `500 unknownException` · `503 inMaintenance`

Todos mapeados para um `CocApiError` tipado com `kind` discriminado (nunca `any`).

---

## 2. Endpoints usados pelo ClashPilot

### Núcleo — camada A

| Endpoint                                  | Uso                                            | TTL cache                               |
| ----------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| `GET /players/{tag}`                      | **fonte primária de tudo**                     | 120 s (quente) / snapshot diário (frio) |
| `POST /players/{tag}/verifytoken`         | prova de propriedade da conta                  | não cacheado                            |
| `GET /clans/{tag}`                        | contexto de clã, nível, guerras                | 600 s                                   |
| `GET /clans/{tag}/currentwar`             | estado de guerra, alerta de ataque pendente    | 120 s                                   |
| `GET /clans/{tag}/capitalraidseasons`     | Capital Raid — participação e contribuição     | 1 h                                     |
| `GET /clans/{tag}/currentwar/leaguegroup` | CWL ativa → calendário                         | 1 h                                     |
| `GET /goldpass/seasons/current`           | início/fim da temporada → calendário e alertas | 6 h                                     |
| `GET /leagues`, `/leagues/{id}`           | metadados e ícones de liga                     | 24 h                                    |

### Secundários

`GET /clans/{tag}/members` (comparativo de doação dentro do clã) ·
`GET /locations/{id}/rankings/players` (percentil de troféus) ·
`GET /clans/{tag}/warlog` (só se `isWarLogPublic`)

---

## 3. Payload de `/players/{tag}` — o que realmente vem

```jsonc
{
  "tag": "#ABC123",
  "name": "Alan",
  "townHallLevel": 14,
  "townHallWeaponLevel": 5,
  "expLevel": 187,
  "trophies": 3120,
  "bestTrophies": 3450,
  "warStars": 812,
  "attackWins": 41,
  "defenseWins": 12,
  "builderHallLevel": 9,
  "builderBaseTrophies": 3900,
  "bestBuilderBaseTrophies": 4010,
  "donations": 1204,
  "donationsReceived": 980,
  "clanCapitalContributions": 145000,
  "role": "coLeader",
  "warPreference": "in",
  "clan": { "tag": "#XYZ", "name": "...", "clanLevel": 18, "badgeUrls": {} },
  "league": { "id": 29000022, "name": "Legend League", "iconUrls": {} },
  "builderBaseLeague": { "id": 44000040, "name": "..." },
  "labels": [],
  "playerHouse": { "elements": [] },
  "achievements": [
    {
      "name": "Empire Builder",
      "stars": 3,
      "value": 14,
      "target": 14,
      "info": "...",
      "completionInfo": "...",
      "village": "home",
    },
  ],
  "troops": [{ "name": "Barbarian", "level": 10, "maxLevel": 11, "village": "home" }],
  "heroes": [
    {
      "name": "Barbarian King",
      "level": 75,
      "maxLevel": 80,
      "village": "home",
      "equipment": [{ "name": "Barbarian Puppet", "level": 18, "maxLevel": 27 }],
    },
  ],
  "heroEquipment": [{ "name": "Giant Gauntlet", "level": 9, "maxLevel": 27, "village": "home" }],
  "spells": [{ "name": "Lightning Spell", "level": 9, "maxLevel": 11, "village": "home" }],
}
```

Observações de implementação:

- **Pets vêm dentro de `troops`** com `village: "home"` — separá-los por lista de nomes conhecida
  (`packages/coc-data/pets.ts`), não por heurística.
- **Super Tropas ativas** aparecem em `troops` com `superTroopIsActive: true`. Devem ser
  **excluídas** do cálculo de MAX% (não são progresso permanente).
- `maxLevel` **é o máximo global do jogo**, não o máximo liberado no TH atual. Para
  "% do que eu posso ter agora" é obrigatório usar a tabela de `packages/coc-data`
  (`maxLevelForTownHall(unit, th)`). Usar `maxLevel` da API aqui é o erro clássico que
  faz o app mostrar 60% para uma vila 100% max.
- Tropas/prédios da **Builder Base** vêm no mesmo array com `village: "builderBase"` —
  particionar sempre.
- Unidades ainda **não desbloqueadas não aparecem no array**. Ausência ≠ nível 0 vs. inexistente:
  o cálculo precisa iterar sobre o _catálogo esperado para aquele TH_, tratando ausente como nível 0.
  Outro erro clássico.
- `achievements` é a única série **vitalícia e monotônica** da API (não reseta por temporada):
  ouro/elixir/EN saqueado, tropas doadas, estrelas de guerra e de CWL, Clan Games, Capital.
  Dois snapshots já dão taxa de farm, ritmo de ataque e detecção de conta parada.
  É a base do detector de atividade e do "ritmo de farm inferido".
- **Alguns achievements revelam nível exato de construção** — a exceção à regra de que a API
  não expõe prédios: `Empire Builder` = nível do **Castelo do Clã**, `Bigger Coffers` = maior
  **Armazém de Ouro**, `Master Engineering` = **Salão do Construtor**. São dados verificados
  (camada A) que o Village Ledger não precisa perguntar.
- Contribuição de guerra é auditável **mesmo com war log privado**, via `War Hero`,
  `War League Legend` e `Clan War Wealth`.

Referência completa campo a campo, com payloads reais: [`docs/api/`](./api/).

---

## 4. Verificação de propriedade da conta (crítico)

`POST /players/{tag}/verifytoken` com body `{"token":"<api token do jogo>"}`
→ `{ "tag":"#...", "token":"...", "status":"ok" | "invalid" }`

O jogador obtém o token em **Configurações → Mais Configurações → Conta da API → Mostrar**.
Token é de uso único e expira rápido.

Este é o mecanismo que permite:

- garantir que a conta pertence ao usuário antes de gravar histórico privado;
- liberar features sensíveis (metas, ledger, notificações);
- evitar que o app vire ferramenta de vigilância de terceiros.

Contas **não verificadas** podem ser adicionadas apenas em modo _read-only/observação_, sem
Village Ledger e sem notificações. Ver [`04-auth.md`](./04-auth.md).

---

## 5. Normalização

Toda resposta passa por um _anti-corruption layer_: DTO da Supercell → tipo de domínio interno.
Nada de tipo da API vazando para UI. Zod valida na borda; falha de schema é logada com
`gameVersion` para detectar mudanças de balanceamento.

```
src/server/coc/dto/*.ts        → shape exato da Supercell (zod)
src/server/coc/mappers/*.ts    → DTO → domínio
src/domain/player/*.ts         → tipos internos, sem dependência externa
```
