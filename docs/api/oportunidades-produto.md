# Oportunidades de produto — o que cada campo viabiliza no ClashPilot

> Este é o documento mais importante do pacote. A tese central: **a API do CoC é um retrato instantâneo, mas contém dezenas de contadores monotônicos vitalícios.** Quem persiste snapshots transforma uma API "sem histórico" numa base de séries temporais. Praticamente todo o diferencial do ClashPilot mora nessa diferença.

---

## 0. A descoberta estrutural: `achievements[]` é o data warehouse escondido

Cada jogador tem 46–54 achievements, e cada um é um `value: number` **cumulativo e monotônico** — nunca reseta, nem por temporada, nem por troca de clã, nem por Ranked. É a **única** fonte de dados vitalícios granulares da API.

Comparação direta:

| Métrica                         | Campo de raiz (reseta)           | Achievement equivalente (vitalício)                 |
| ------------------------------- | -------------------------------- | --------------------------------------------------- |
| Doações                         | `donations` (reseta todo mês)    | `Friend in Need` → capacidade total de tropas doada |
| Doação de feitiços              | _(não existe)_                   | `Sharing is caring`                                 |
| Doação de cercos                | _(não existe)_                   | `Siege Sharer`                                      |
| Ataques vencidos                | `attackWins` (reseta)            | `Conqueror`                                         |
| Defesas vencidas                | `defenseWins` (reseta)           | `Unbreakable`                                       |
| Ouro saqueado                   | _(não existe)_                   | `Gold Grab`                                         |
| Elixir saqueado                 | _(não existe)_                   | `Elixir Escapade`                                   |
| Elixir negro saqueado           | _(não existe)_                   | `Heroic Heist`                                      |
| Pontos de Clan Games            | _(não existe)_                   | `Games Champion`                                    |
| Pontos de Desafios de Temporada | _(não existe)_                   | `Well Seasoned`                                     |
| Ouro da Capital saqueado        | _(só no raid season, 6 semanas)_ | `Aggressive Capitalism` (vitalício)                 |

**Isso vale mais do que parece:** `capitalraidseasons` só guarda ~6 fins de semana, e `donations` é apagado todo mês. Os achievements sobrevivem a tudo.

### Tabela completa — achievements com sinal de produto

| Achievement                                                                                                                                                                                                                                                                                                                                                      | `value` significa                                                                                                                                     | Sinal derivado                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bigger & Better`                                                                                                                                                                                                                                                                                                                                                | **Nível atual da Câmara do Construtor (TH)**                                                                                                          | redundante com `townHallLevel`, mas serve de checksum                                                                                             |
| `Empire Builder`                                                                                                                                                                                                                                                                                                                                                 | **Nível atual do Castelo do Clã** ⚠️ (o briefing dizia "nível do TH" — está errado; `completionInfo` é literalmente `"Current Clan Castle level: 4"`) | capacidade de tropas do CC → limite de doação recebida; cota inferior de TH                                                                       |
| `Bigger Coffers`                                                                                                                                                                                                                                                                                                                                                 | **Maior nível de Armazém de Ouro**                                                                                                                    | cota inferior de TH; detecção de rush econômico                                                                                                   |
| `Master Engineering`                                                                                                                                                                                                                                                                                                                                             | **Nível atual do Salão do Construtor**                                                                                                                | idem para Builder Base                                                                                                                            |
| `Gold Grab`                                                                                                                                                                                                                                                                                                                                                      | Ouro total saqueado (vitalício)                                                                                                                       | **Δ/dia = taxa de farm de ouro.** Δ = 0 em 24 h ⇒ não atacou                                                                                      |
| `Elixir Escapade`                                                                                                                                                                                                                                                                                                                                                | Elixir total saqueado                                                                                                                                 | **Δ/dia = taxa de farm de elixir**                                                                                                                |
| `Heroic Heist`                                                                                                                                                                                                                                                                                                                                                   | Elixir Negro total saqueado                                                                                                                           | Δ/dia = taxa de farm de EN → gargalo real de herói                                                                                                |
| `Conqueror`                                                                                                                                                                                                                                                                                                                                                      | Batalhas multiplayer vencidas (vitalício)                                                                                                             | ritmo de ataque, "ataques por dia"                                                                                                                |
| `Unbreakable`                                                                                                                                                                                                                                                                                                                                                    | Defesas vencidas (vitalício)                                                                                                                          | ⚠️ **não é sinal de atividade** — sobe com o jogador offline                                                                                      |
| `Friend in Need`                                                                                                                                                                                                                                                                                                                                                 | Capacidade de tropa doada (vitalício)                                                                                                                 | ranking de doador real do clã, imune a reset mensal                                                                                               |
| `Sharing is caring`                                                                                                                                                                                                                                                                                                                                              | Capacidade de feitiço doada                                                                                                                           | doador "premium" (feitiços custam mais)                                                                                                           |
| `Siege Sharer`                                                                                                                                                                                                                                                                                                                                                   | Cercos doados                                                                                                                                         | membro que sustenta guerra                                                                                                                        |
| `War Hero`                                                                                                                                                                                                                                                                                                                                                       | Estrelas de guerra para o clã (vitalício)                                                                                                             | performance histórica de guerra sem depender do warlog                                                                                            |
| `War League Legend`                                                                                                                                                                                                                                                                                                                                              | Estrelas de CWL (vitalício)                                                                                                                           | **separa contribuição de CWL da de guerra normal** — impossível pelo warlog (CWL vem com `result: null` e sem membros)                            |
| `Clan War Wealth`                                                                                                                                                                                                                                                                                                                                                | Ouro de bônus de guerra coletado                                                                                                                      | proxy de **guerras concluídas com bônus** — mede consistência, não só ataques                                                                     |
| `Games Champion`                                                                                                                                                                                                                                                                                                                                                 | Pontos de Clan Games (vitalício)                                                                                                                      | **Δ por evento = participação individual em Clan Games.** A API não tem endpoint de Clan Games — este é o único caminho                           |
| `Well Seasoned`                                                                                                                                                                                                                                                                                                                                                  | Pontos de Desafios de Temporada                                                                                                                       | engajamento com Gold Pass / desafios                                                                                                              |
| `Aggressive Capitalism`                                                                                                                                                                                                                                                                                                                                          | Ouro da Capital saqueado em raids                                                                                                                     | participação em raid **vitalícia**, sobrevive à janela de 6 semanas                                                                               |
| `Most Valuable Clanmate`                                                                                                                                                                                                                                                                                                                                         | Ouro da Capital contribuído                                                                                                                           | espelha `clanCapitalContributions`                                                                                                                |
| `Nice and Tidy`                                                                                                                                                                                                                                                                                                                                                  | Obstáculos removidos                                                                                                                                  | proxy de **renda de gemas** e de tempo de jogo diário (limpeza é rotina diária)                                                                   |
| `Superb Work`                                                                                                                                                                                                                                                                                                                                                    | Super Tropas ativadas                                                                                                                                 | uso de EN em boost = jogador avançado                                                                                                             |
| `Supercharger`                                                                                                                                                                                                                                                                                                                                                   | Supercharges (TH17+)                                                                                                                                  | estágio de endgame                                                                                                                                |
| `Crafting Connoisseur`                                                                                                                                                                                                                                                                                                                                           | Upgrades de Defesa Criada                                                                                                                             | idem                                                                                                                                              |
| `Wall Buster`, `Humiliator`, `Union Buster`, `Mortar Mauler`, `X-Bow Exterminator`, `Firefighter`, `Anti-Artillery`, `Shattered and Scattered`, `Not So Easy This Time`, `Bust This!`, `Counterspell`, `Monolith Masher`, `Multi-Archer Tower Terminator`, `Ricochet Cannon Crusher`, `Firespitter Finisher`, `Multi-Gear Tower Trampler`, `Crafter's Nightmare` | contadores de destruição por tipo de estrutura                                                                                                        | **volume total de ataques** e **contra quais TH o jogador ataca** (só destrói Monolito quem ataca TH15+) → inferir faixa de dificuldade escolhida |
| `Get even more Goblins!`                                                                                                                                                                                                                                                                                                                                         | Estrelas de campanha                                                                                                                                  | conta nova vs. veterana                                                                                                                           |
| `Keep Your Account Safe!` (×2)                                                                                                                                                                                                                                                                                                                                   | Supercell ID / rede social vinculada                                                                                                                  | risco de perda de conta — nudge de segurança                                                                                                      |
| `League All-Star`, `League Master`                                                                                                                                                                                                                                                                                                                               | marcos de liga                                                                                                                                        | progresso no sistema Ranked                                                                                                                       |

⚠️ Existem **dois** achievements chamados `Keep Your Account Safe!` — desambiguar por `info`, nunca indexar só por `name`.

---

## 1. Motor de atividade e detecção de conta parada

Esta é a feature de maior valor por menor custo. Com **2 snapshots de `/players/{tag}`** (custo: 2 requests, `max-age=60`):

**Escada de sinais, do mais forte ao mais fraco:**

| Prioridade | Δ observado                                        | Conclusão                                                         |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| 1          | `Gold Grab` ou `Elixir Escapade` subiu             | **atacou** (loot só sobe atacando)                                |
| 2          | `Conqueror` subiu                                  | ganhou ataque                                                     |
| 3          | `Friend in Need` subiu                             | **doou** (exige estar online e responder)                         |
| 4          | `Nice and Tidy` subiu                              | removeu obstáculo = logou na vila                                 |
| 5          | `trophies` mudou                                   | jogou ou foi atacado (ambíguo)                                    |
| 6          | `donations` subiu                                  | doou (mas zera no reset mensal)                                   |
| 7          | `clanRank` ≠ `previousClanRank` (via `memberList`) | movimento relativo no clã — **grátis, 1 request para 50 membros** |
| ❌         | `Unbreakable` / `defenseWins` subiu                | **NÃO é atividade** — acontece offline                            |

**Feature: "Score de atividade" por membro**, com estados `ativo` / `esfriando` / `parado há N dias` / `provavelmente abandonou`.
**Feature: "Kick list assistida"** — cruza inatividade com `warPreference: "in"` (pior combinação: opta por guerra e não ataca) e com ausência em `capitalraidseasons.members[]`.

**Atalho de custo:** `GET /clans/{tag}` traz `memberList` com `donations`, `donationsReceived`, `trophies`, `clanRank`, `previousClanRank` para **todos os 50 membros em 1 request**. Monitoramento diário do clã inteiro ≈ 1 req/2 min. O fan-out para `/players/{tag}` (50 requests) só precisa rodar 1×/dia.

---

## 2. Progresso de vila e "o que subir agora"

`troops[]`, `heroes[]`, `spells[]`, `heroEquipment[]` dão o **nível exato de cada unidade**. `maxLevel` é o teto **global** do jogo, inútil para "o que falta no meu TH".

**Necessário:** tabela estática própria `(unidade, townHallLevel) → maxLevel`. Fontes: `clashofclans.js/src/util/raw.json` (mantido e versionado), pacote `clash-of-clans-data`, wiki.

**Features viabilizadas:**

- **Rush Score:** média ponderada de `level / maxLevelDoTH` por categoria (defesas não dá — mas tropas/heróis/feitiços/equipamentos dá) → "seu TH14 está 62% completo em laboratório".
- **Fila de upgrade recomendada:** ordenar o que falta por impacto × custo × tempo, cruzando com a taxa de farm derivada do `Gold Grab`/`Elixir Escapade`/`Heroic Heist` → **"no seu ritmo atual de EN (43k/dia), Rainha 75→80 leva 9 dias"**. Este é o _copiloto_ que o produto promete, e sai inteiro da API + tabela estática.
- **Detecção de upgrade em andamento (inferência):** se entre dois snapshots um herói **não muda de nível mas o jogador está claramente ativo**, e o nível está abaixo do máximo do TH, ele provavelmente está em upgrade. ⚠️ **Não confirmável** — a API não expõe timers nem disponibilidade de herói.
- **Detecção de upgrade concluído:** Δ de `level` entre snapshots é exato → **linha do tempo completa de laboratório e heróis**, retroativa a partir do momento em que o ClashPilot começa a observar.
- **`superTroopIsActive`:** só aparece quando ativo → alerta "sua Super Tropa expira em ~3 dias" (boost dura 3 dias; o início dá para inferir pelo primeiro snapshot em que a flag aparece).
- **`heroes[].equipment` vs `heroEquipment[]`:** o primeiro é o _loadout equipado agora_, o segundo é o _inventário_. Isso permite **"você tem o Escudo do Guerreiro nível 18 mas não está usando"** — recomendação de loadout, algo que nenhum site popular explora.
- **`townHallWeaponLevel`:** só existe em TH ≥ 12. Ausência = TH ≤ 11 — checksum útil.

---

## 3. O que dá para inferir sobre construções (contradiz parcialmente a premissa (a))

A API **não** tem endpoint de construções. Mas:

**Níveis EXATOS que a API entrega, apesar disso:**

| Construção                                  | Como                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Câmara do Construtor                        | `townHallLevel`                                                       |
| Arma da TH (Giga Tesla/Inferno)             | `townHallWeaponLevel`                                                 |
| **Castelo do Clã**                          | achievement `Empire Builder`.`value`                                  |
| **Armazém de Ouro (maior)**                 | achievement `Bigger Coffers`.`value`                                  |
| Salão do Construtor                         | `builderHallLevel` + achievement `Master Engineering`                 |
| Salão da Capital + **todos os 9 distritos** | `clan.clanCapital.capitalHallLevel` e `districts[].districtHallLevel` |

**Cotas inferiores (limites inferiores) deriváveis:**

| Construção                                       | Inferência                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Laboratório                                      | nível mínimo que permite o maior `level` de tropa observado            |
| Ferraria (Blacksmith)                            | mínimo que permite o maior `level` de equipamento em `heroEquipment[]` |
| Fábrica de Feitiços / Fábrica de Feitiços Negros | presença e nível de feitiços em `spells[]`                             |
| Oficina (Workshop)                               | presença/nível de máquinas de cerco em `troops[]`                      |
| Casa dos Animais (Pet House)                     | presença/nível de pets em `troops[]`                                   |
| Quartel / Quartel Negro                          | quais tropas estão desbloqueadas                                       |
| Altar do Rei / Rainha / Guardião / Campeã        | `heroes[]` — existência e `level`                                      |

Uma barra de progresso de vila razoavelmente honesta é construível **só com a API**, cobrindo laboratório + heróis + equipamentos + capital, mais 4 construções exatas.

**O que continua invisível:** níveis de defesas individuais, muralhas (quantidade por nível), número de construtores, construtores ocupados/livres, Aparelho de O.T.T.O, timers de upgrade, recursos em caixa (ouro/elixir/EN/gemas), armadilhas, layout da base, escudo/guarda, exército montado.

---

## 4. Guerra (`currentwar`) — o que dá para extrair sem log público

`/clans/{tag}/currentwar` traz `attacks[]` com `attackerTag`, `defenderTag`, `stars`, `destructionPercentage`, **`order`** e **`duration`**.

**Features viabilizadas:**

- **Ataques não usados:** `attacks` **ausente** (a chave some) ou `attacks.length < attacksPerMember`. Detector canônico de membro que não atacou.
- **Estrelas novas vs. redundantes:** cruzando `order` com o estado anterior de cada defensor dá para computar quantas estrelas cada ataque **adicionou** ao placar (um 3★ num alvo já 3★ vale 0). Nenhum app gratuito faz isso bem.
- **Ataque para cima/para baixo:** `mapPosition` do atacante vs. do defensor, e `townhallLevel` de ambos → "sempre ataca 3 posições abaixo" (inflador de estatística) vs. "sobe 2 e pega 2★".
- **`duration`:** tempo de ataque em segundos. `duration ≈ 180` + poucas estrelas = ataque que não terminou; `duration` baixo com 3★ = ataque limpo. Métrica de qualidade que quase ninguém usa.
- **Heatmap de horário:** `order` só dá sequência, **não timestamp**. Mas com polling a cada ~2 min (`max-age=120`) você carimba o horário de cada ataque ao vê-lo aparecer → **mapa de "quando cada membro está online"**, insumo para escalar guerra e para o motor de atividade.
- **`bestOpponentAttack` + `opponentAttacks`:** performance defensiva por membro.
- **`battleModifier: "hardMode"`:** separar estatísticas de Hard Mode das normais (senão a média de estrelas fica corrompida).

**Limitação crítica — janela de captura:** quando a guerra termina, `currentwar` avança para a próxima e **os ataques individuais somem para sempre**. O `warlog` guarda só o placar agregado, e **CWL nem isso** (`result: null`, `opponent` sem tag). **O ClashPilot precisa de um job que persista `currentwar` durante `inWar`/`warEnded` antes da rotação.** Isso é o fosso competitivo: histórico individual de guerra não é recuperável retroativamente.

**Sem log público (`isWarLogPublic: false`):** `/warlog` e `/currentwar` devolvem 403. Sobram: `warWins` e `warWinStreak` (sempre visíveis), a **ausência** de `warTies`/`warLosses` como detector de log privado, e os achievements `War Hero` / `War League Legend` / `Clan War Wealth` de cada membro — que permitem reconstruir contribuição de guerra **mesmo com o clã fechado**. Achado forte.

---

## 5. Capital e Raids

`capitalraidseasons` é o endpoint com melhor razão sinal/custo depois de `players`:

- `members[].attacks` vs `attackLimit + bonusAttackLimit` → **% de participação exata** por membro.
- **Membros ausentes não aparecem em `members[]`** — cruzar com `memberList` produz a lista de faltosos.
- `capitalResourcesLooted` → ranking de contribuição ofensiva.
- **`attackLog[].districts[].attacks[]`** (não tipado por nenhum wrapper, existe no payload real): cada ataque individual com atacante, `stars` e `destructionPercent` → **eficiência de raid por jogador** ("gastou 3 ataques para fechar um distrito nível 5" vs "fechou em 1"). Feature de coaching que ninguém oferece.
- `defenseLog` → quão bem a Capital do clã aguenta; cruzar com `districts[].districtHallLevel` para priorizar upgrade de distrito.
- `offensiveReward`/`defensiveReward` → medalhas ganhas, base de "vale a pena o esforço?".
- Janela de retenção: ~6 temporadas. **Persistir.**

---

## 6. Ranked / Lenda

- **`legendStatistics`**: `bestSeason` e `previousSeason` vêm completos (`id`, `rank`, `trophies`); **`currentSeason` vem só com `trophies`** — sem `rank`, sem `id`. Para tracking diário de Lenda é obrigatório **snapshot próprio de `currentSeason.trophies`** ao menos 1×/dia (idealmente logo após o reset diário às 05:00 UTC) → curva de +/- troféus por dia, e "net trophies" da temporada.
- `legendTrophies` é vitalício.
- `leagueTier` (novo, out/2025) substituiu `league`. `memberList` ainda traz **os dois** — use `leagueTier` e mantenha `league` como fallback.
- `/leagues/29000022/seasons/{id}` dá o ranking final de temporadas passadas de Lenda — histórico global gratuito.
- ⚠️ `/players/{tag}/leaguehistory` e `/leaguegroup/{tag}/{season}` (novos, Ranked) prometem histórico de temporada e logs de ataque/defesa **com `creationTime`** — se acessíveis com chave comum, resolvem o tracking de Ranked sem polling. **Validar cedo**: muda a arquitetura de coleta.

---

## 7. Descoberta e social

- `GET /clans` com `minClanLevel` + `locationId` + `labelIds` + `warFrequency` → **motor de "encontre um clã pra você"** casando o perfil do jogador (TH, `warPreference`, taxa de doação vitalícia) com clãs que aceitam (`requiredTrophies`, `requiredTownhallLevel`).
- `POST /players/{tag}/verifytoken` → **login sem senha e prova de propriedade**. É o que separa "ferramenta de consulta" de "produto com conta". Habilita dados privados, notificações e histórico pessoal. **Deve estar no MVP.**
- `labels` de jogador e clã → segmentação pronta ("Farmer", "Clan Wars", "Amigável").
- `chatLanguage` + `location` → localização automática da UI e matching por idioma.
- Rankings por `locationId` → percentil "você é top X% no Brasil".
- `goldpass/seasons/current` → agendar os snapshots de fim de temporada **antes** do reset.

---

## 8. Lista priorizada — features VIABILIZADAS só com a API oficial

| #   | Feature                                                          | Endpoints                                   | Esforço | Impacto                     |
| --- | ---------------------------------------------------------------- | ------------------------------------------- | ------- | --------------------------- |
| 1   | Motor de atividade / kick list assistida                         | `players`, `clans`                          | Baixo   | **Altíssimo**               |
| 2   | Taxa de farm (ouro/elixir/EN por dia) via Δ achievements         | `players`                                   | Baixo   | **Altíssimo**               |
| 3   | Fila de upgrade recomendada com ETA baseado no farm real         | `players` + tabela estática                 | Médio   | **Altíssimo**               |
| 4   | Rush Score / completude de laboratório por TH                    | `players` + tabela estática                 | Baixo   | Alto                        |
| 5   | Histórico individual de guerra (requer snapshot de `currentwar`) | `currentwar` + job                          | Médio   | Alto                        |
| 6   | Participação e eficiência em Raid da Capital                     | `capitalraidseasons`                        | Baixo   | Alto                        |
| 7   | Doador vitalício (imune a reset mensal)                          | `players`                                   | Baixo   | Alto                        |
| 8   | Contribuição de guerra **mesmo com clã de log privado**          | achievements `War Hero`/`War League Legend` | Baixo   | Alto (diferencial)          |
| 9   | Login com `verifytoken`                                          | `verifytoken`                               | Baixo   | Alto                        |
| 10  | Tracking diário de Lenda                                         | `players.legendStatistics` + job            | Baixo   | Médio                       |
| 11  | Participação em Clan Games via Δ `Games Champion`                | `players`                                   | Baixo   | Médio (não existe endpoint) |
| 12  | Heatmap de horário online (via polling de `currentwar`)          | `currentwar` + job                          | Médio   | Médio                       |
| 13  | Recomendação de loadout de equipamento                           | `players.heroes[].equipment`                | Baixo   | Médio (inexplorado)         |
| 14  | Alerta de expiração de Super Tropa                               | `players.troops[].superTroopIsActive`       | Baixo   | Médio                       |
| 15  | Priorização de upgrade de distrito da Capital                    | `clans.clanCapital` + `defenseLog`          | Baixo   | Médio                       |
| 16  | Busca/matching de clã                                            | `clans` (search) + `labels` + `locations`   | Médio   | Médio                       |
| 17  | Percentil regional/global                                        | `locations/*/rankings/*`                    | Baixo   | Baixo                       |

---

## 9. Features IMPOSSÍVEIS só com a API — e a fonte alternativa

| Feature                                              | Por quê                                          | Fonte alternativa necessária                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Recursos em caixa (ouro/elixir/EN/gemas)             | Não exposto                                      | **Input manual do usuário** (formulário rápido) ou OCR de print — fora de escopo de automação                              |
| Nº de construtores e quais estão livres              | Não exposto                                      | Input manual (o usuário informa 5/6 construtores + O.T.T.O)                                                                |
| Timers de upgrade em andamento                       | Não exposto                                      | Input manual + inferência por Δ de snapshot                                                                                |
| Níveis de defesas individuais e muralhas             | Não exposto                                      | Input manual, ou **estimativa** por `townHallLevel` + tempo desde que chegou no TH                                         |
| Nº de muralhas por nível                             | Não exposto                                      | Input manual (é o dado mais pedido e o mais caro de coletar)                                                               |
| Custo/tempo exato de cada upgrade                    | Não exposto                                      | **Tabela estática obrigatória** (`clash-of-clans-data`, wiki) — é dependência de projeto, não opcional                     |
| `maxLevel` por TH                                    | `maxLevel` é global                              | **Tabela estática obrigatória**                                                                                            |
| Loot por ataque individual                           | `battlelog` é escopo restrito                    | ⚠️ Testar `battlelog` com chave real; senão, aproximar por Δ `Gold Grab` ÷ Δ `Conqueror`                                   |
| Histórico de guerra retroativo (antes do onboarding) | `warlog` não tem membros; `currentwar` rotaciona | Nenhuma. **Só coletando a partir de agora** — argumento forte para começar a ingestão cedo, mesmo antes do produto existir |
| Ataques individuais de CWL passados                  | Idem, e o warlog nem traz `result`               | Snapshot de `/clanwarleagues/wars/{warTag}` durante o mês                                                                  |
| Pontos individuais por evento de Clan Games          | Só o total vitalício                             | Δ de `Games Champion` entre início e fim do evento (aproximação boa)                                                       |
| "Último login" exato                                 | Não exposto                                      | Inferência por Δ de contadores (granularidade ≈ intervalo de polling)                                                      |
| Layout/base de guerra                                | Não exposto                                      | Nenhuma                                                                                                                    |
| Escudo, guarda pessoal, status de férias             | Não exposto                                      | Nenhuma                                                                                                                    |
| Chat do clã / eventos do clã (entrou/saiu/promoveu)  | Não exposto                                      | **Diff de `memberList` entre snapshots** reconstrói entradas, saídas e mudanças de cargo com fidelidade alta               |
| Notificação em tempo real (webhook)                  | Não existe                                       | Polling respeitando `Cache-Control`                                                                                        |

---

## 10. Consequências de arquitetura

1. **O ingestor é o produto.** Sem snapshots persistidos, o ClashPilot é só mais um visualizador de perfil. Com eles, é o único que responde "como você evoluiu".
2. **Comece a coletar antes de lançar.** Histórico de guerra e de laboratório é irrecuperável retroativamente.
3. **Cadência sugerida:** `clans/{tag}` a cada 2–5 min (clãs ativos) para membros/ranks; `players/{tag}` 1–4×/dia (fan-out de 50); `currentwar` a cada 2 min durante `inWar`; `capitalraidseasons` 1×/dia; snapshot forçado ~15 min antes de `goldpass.endTime`.
4. **Modelo de dados:** guardar achievements como `(playerTag, achievementName, value, capturedAt)` — série temporal esparsa, só grava quando o valor muda. Compacta muito bem e responde qualquer pergunta de "taxa de X".
5. **A tabela estática de níveis por TH é dependência crítica de projeto**, não um detalhe. Versioná-la e atualizá-la a cada update do jogo.
