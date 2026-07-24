# Modelagem de dados

PostgreSQL (**Railway**, junto do gateway) + Prisma. Redis (Upstash) apenas como cache/fila —
**nunca** como fonte de verdade.

> Banco e gateway no mesmo provedor e região: o worker de sync é quem mais escreve, e ele passa
> a falar com o Postgres pela rede privada do Railway (latência ~1 ms, sem custo de egresso).
> A Vercel acessa o mesmo banco pela URL pública com pooler — ver [ADR-011](./10-decisoes.md).

---

## 1. Princípios

1. **Histórico é imutável e append-only.** Nada de `UPDATE` em snapshot. "Nunca perder histórico"
   é requisito, então snapshot e evento não têm `updatedAt` nem delete em cascata direto.
2. **Snapshot ≠ evento.** Snapshot é foto diária (barato de ler para gráficos).
   Evento é o delta (barato de ler para timeline e para "quando foi que…").
   Guardar os dois é redundância deliberada: evita `LAG()` sobre milhões de linhas em toda query.
3. **Estado atual é materializado.** `PlayerCurrent` é cache derivado em tabela, reconstruível
   a partir do último snapshot. Zero cálculo pesado no caminho do dashboard.
4. **Dado declarado é separado do verificado.** Nunca misturar na mesma tabela — cada valor
   carrega `source` e `confidence`.
5. **Sem `Json` onde há query.** `Json` só para payload bruto arquivado e `meta` de evento.

---

## 2. Estratégia de histórico e volume

| Camada              | Granularidade                            | Retenção                                  | Volume/jogador/ano    |
| ------------------- | ---------------------------------------- | ----------------------------------------- | --------------------- |
| `PlayerSnapshot`    | 1/dia (+1 no fim de temporada)           | perpétua                                  | ~370 linhas           |
| `PlayerSnapshotRaw` | payload bruto comprimido (`bytea`, gzip) | 90 dias, depois só o do dia 1 de cada mês | ~10 MB → ~1 MB        |
| `ProgressEvent`     | por mudança real                         | perpétua                                  | ~400–800 linhas       |
| `MetricPoint` (hot) | 1/hora para troféus/doações              | 30 dias, depois agregado no snapshot      | ~720/mês, com pruning |

Escala confortável: 10 mil jogadores ≈ 4 M snapshots/ano ≈ poucos GB. Particionamento por
`RANGE (capturedAt)` em `PlayerSnapshot` fica preparado desde já (declarativo no Postgres),
ativado quando passar de ~20 M linhas.

**Idempotência do sync:** `@@unique([playerId, capturedOn])` com `capturedOn` = `date` em UTC.
Rodar o worker duas vezes no mesmo dia atualiza o snapshot do dia (única exceção à imutabilidade,
protegida por `revision`), nunca duplica.

---

## 3. Schema Prisma (v1)

```prisma
// ---------- Auth (Better Auth) ----------
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified Boolean  @default(false)
  name          String?
  image         String?
  locale        String   @default("pt-BR")
  timezone      String   @default("America/Sao_Paulo")
  plannerTier   PlannerTier @default(BRONZE)
  plannerXp     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions      Session[]
  accounts      Account[]
  players       Player[]
  pushSubs      PushSubscription[]
  goals         Goal[]
  unlocked      UnlockedAchievement[]
  advisorThreads AdvisorThread[]
}

model Session { id String @id @default(cuid()) userId String user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  token String @unique expiresAt DateTime ipAddress String? userAgent String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([userId]) }

model Account { id String @id @default(cuid()) userId String user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  accountId String providerId String accessToken String? refreshToken String? idToken String?
  accessTokenExpiresAt DateTime? scope String? password String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@unique([providerId, accountId]) }

model Verification { id String @id @default(cuid()) identifier String value String expiresAt DateTime createdAt DateTime @default(now()) @@index([identifier]) }

// ---------- Conta de jogo ----------
model Player {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tag          String                    // normalizado: "#ABC123" upper, sem O/I ambíguos
  name         String
  verified     Boolean  @default(false)  // via /verifytoken
  verifiedAt   DateTime?
  isPrimary    Boolean  @default(false)
  syncEnabled  Boolean  @default(true)
  syncPriority Int      @default(0)      // verificados e ativos primeiro na fila
  lastSyncAt   DateTime?
  lastSyncStatus SyncStatus @default(PENDING)
  createdAt    DateTime @default(now())

  current      PlayerCurrent?
  snapshots    PlayerSnapshot[]
  events       ProgressEvent[]
  buildings    VillageBuilding[]
  jobs         UpgradeJob[]
  goals        Goal[]
  alerts       Alert[]
  insights     Insight[]

  @@unique([userId, tag])
  @@index([tag])
  @@index([syncEnabled, lastSyncAt])   // fila do worker
}

// Estado atual materializado — leitura do dashboard em 1 query
model PlayerCurrent {
  playerId       String @id
  player         Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  townHallLevel  Int
  townHallWeapon Int?
  expLevel       Int
  trophies       Int
  bestTrophies   Int
  leagueId       Int?
  leagueName     String?
  warStars       Int
  attackWins     Int
  defenseWins    Int
  donations      Int
  donationsReceived Int
  clanTag        String?
  clanName       String?
  builderHallLevel Int?
  builderTrophies  Int?
  capitalContributions Int @default(0)

  units          Json     // UnitState[] normalizado (tropas/feitiços/heróis/pets/equip)
  achievements   Json     // AchievementState[]

  villageScore   Int?     // 0-100
  maxProgressBp  Int?     // basis points: 7240 = 72,40%
  scoreBreakdown Json?    // por categoria
  computedAt     DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PlayerSnapshot {
  id            String   @id @default(cuid())
  playerId      String
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  capturedAt    DateTime @default(now())
  capturedOn    DateTime @db.Date          // chave de idempotência (UTC)
  revision      Int      @default(1)
  kind          SnapshotKind @default(DAILY)

  townHallLevel Int
  expLevel      Int
  trophies      Int
  bestTrophies  Int
  leagueId      Int?
  warStars      Int
  attackWins    Int
  defenseWins   Int
  donations     Int
  donationsReceived Int
  clanTag       String?
  builderHallLevel Int?
  builderTrophies  Int?

  // agregados pré-calculados: o que faz o gráfico ser instantâneo
  villageScore  Int?
  maxProgressBp Int?
  heroSumLevel  Int?
  labProgressBp Int?
  goldSpentTotal    BigInt?   // de achievements
  elixirSpentTotal  BigInt?
  darkSpentTotal    BigInt?
  units         Json

  raw           PlayerSnapshotRaw?

  @@unique([playerId, capturedOn])
  @@index([playerId, capturedAt])
}

model PlayerSnapshotRaw {
  snapshotId String @id
  snapshot   PlayerSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  payload    Bytes          // gzip(JSON)
  gameVersion String?
}

model ProgressEvent {
  id        String    @id @default(cuid())
  playerId  String
  player    Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  at        DateTime  @default(now())
  type      EventType
  key       String?              // "Barbarian King", "Cannon", "Lightning Spell"
  category  UnitCategory?
  fromLevel Int?
  toLevel   Int?
  delta     Int?                 // troféus, doações
  meta      Json?
  source    DataSource @default(API)

  @@index([playerId, at])
  @@index([playerId, type, at])
}

// ---------- Camada B: Village Ledger ----------
model VillageBuilding {
  id         String   @id @default(cuid())
  playerId   String
  player     Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  buildingKey String              // "cannon", "wall", "laboratory" (catálogo)
  slot       Int      @default(0) // 1..N para prédios repetidos; walls usa contagem agregada
  level      Int
  count      Int      @default(1) // usado por muralhas: 250 paredes nível 12
  source     DataSource @default(MANUAL)
  confidence Int      @default(100)  // decai com o tempo
  updatedAt  DateTime @updatedAt

  @@unique([playerId, buildingKey, slot])
  @@index([playerId])
}

model UpgradeJob {
  id         String     @id @default(cuid())
  playerId   String
  player     Player     @relation(fields: [playerId], references: [id], onDelete: Cascade)
  kind       JobKind                 // BUILDING | LAB | HERO | PET | EQUIPMENT
  targetKey  String
  fromLevel  Int
  toLevel    Int
  builderNo  Int?                    // 1..6 (null p/ lab, pet house, ferreiro)
  startedAt  DateTime
  endsAt     DateTime
  finishedAt DateTime?
  status     JobStatus  @default(RUNNING)
  costAmount BigInt
  costType   Resource
  usedBook   Boolean    @default(false)
  usedHammer Boolean    @default(false)

  @@index([playerId, status, endsAt])
}

// ---------- Metas, conquistas, gamificação ----------
model Goal {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  playerId  String
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  title     String
  metric    GoalMetric
  targetKey String?             // "Barbarian King" para HERO_LEVEL
  targetValue Int
  baselineValue Int
  dueDate   DateTime?
  status    GoalStatus @default(ACTIVE)
  achievedAt DateTime?
  createdAt DateTime @default(now())
  @@index([playerId, status])
}

model AchievementDef {           // seed, versionado no repo
  key         String @id
  title       String
  description String
  icon        String
  tier        AchievementTier
  xp          Int
  rule        Json               // DSL avaliada pelo motor
  hidden      Boolean @default(false)
}

model UnlockedAchievement {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  key    String
  def    AchievementDef @relation(fields: [key], references: [key])
  playerId String?
  unlockedAt DateTime @default(now())
  progress   Int @default(100)
  @@unique([userId, key])
}

// ---------- Insights, alertas, notificações ----------
model Insight {
  id        String   @id @default(cuid())
  playerId  String
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  kind      String                  // "lab_idle", "wall_overinvest", ...
  severity  Severity @default(INFO)
  title     String
  body      String
  dataRef   Json?
  actionKey String?                 // deep-link para a ação sugerida
  createdAt DateTime @default(now())
  dismissedAt DateTime?
  @@index([playerId, createdAt])
  @@unique([playerId, kind, createdAt])
}

model Alert {
  id        String    @id @default(cuid())
  playerId  String
  player    Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  type      AlertType
  fireAt    DateTime
  payload   Json
  status    AlertStatus @default(SCHEDULED)
  sentAt    DateTime?
  @@index([status, fireAt])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
  lastOkAt  DateTime?
  failures  Int      @default(0)
}

model NotificationPref {
  userId   String   @id
  builderFree Boolean @default(true)
  labDone     Boolean @default(true)
  warAttack   Boolean @default(true)
  seasonEnd   Boolean @default(true)
  weeklyDigest Boolean @default(true)
  quietFrom   Int?     // hora local 0-23
  quietTo     Int?
}

// ---------- Advisor ----------
model AdvisorThread {
  id       String @id @default(cuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  playerId String
  title    String
  createdAt DateTime @default(now())
  messages AdvisorMessage[]
}

model AdvisorMessage {
  id       String @id @default(cuid())
  threadId String
  thread   AdvisorThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role     MessageRole
  content  String
  contextHash String?      // snapshot usado, p/ reprodutibilidade
  tokensIn Int?
  tokensOut Int?
  createdAt DateTime @default(now())
  @@index([threadId, createdAt])
}

// ---------- Enums ----------
enum PlannerTier   { BRONZE SILVER GOLD DIAMOND LEGEND }
enum SyncStatus    { PENDING OK NOT_FOUND THROTTLED MAINTENANCE ERROR }
enum SnapshotKind  { DAILY SEASON_END MANUAL MIGRATION }
enum DataSource    { API MANUAL INFERRED SYSTEM }
enum UnitCategory  { TROOP SPELL HERO PET EQUIPMENT SIEGE BUILDING WALL TRAP }
enum EventType     { TH_UP HERO_LEVEL_UP TROOP_LEVEL_UP SPELL_LEVEL_UP PET_LEVEL_UP EQUIPMENT_LEVEL_UP
                     BUILDING_LEVEL_UP WALL_BATCH LEAGUE_CHANGE TROPHY_PEAK ACHIEVEMENT_TIER
                     CLAN_CHANGE JOB_STARTED JOB_FINISHED IDLE_DETECTED }
enum JobKind       { BUILDING LAB HERO PET EQUIPMENT }
enum JobStatus     { RUNNING DONE CANCELLED }
enum Resource      { GOLD ELIXIR DARK_ELIXIR GEMS }
enum GoalMetric    { TH_LEVEL HERO_LEVEL LAB_COMPLETION WALL_COMPLETION VILLAGE_SCORE MAX_PROGRESS TROPHIES CUSTOM }
enum GoalStatus    { ACTIVE ACHIEVED ARCHIVED FAILED }
enum AchievementTier { BRONZE SILVER GOLD DIAMOND }
enum Severity      { INFO SUCCESS WARNING CRITICAL }
enum AlertType     { BUILDER_FREE LAB_DONE JOB_DONE RESOURCES_FULL SHIELD_END BOOST_END SEASON_END
                     CWL_START CLAN_GAMES CAPITAL_RAID WAR_ATTACK_PENDING IDLE_NUDGE }
enum AlertStatus   { SCHEDULED SENT CANCELLED FAILED }
enum MessageRole   { USER ASSISTANT SYSTEM }
```

---

## 4. Catálogo do jogo (não vai ao banco)

`packages/coc-data` — dados estáticos, tipados, versionados:

```
packages/coc-data/src/
  buildings.ts    # por prédio: níveis, custo, tempo, TH mínimo, quantidade por TH
  troops.ts  spells.ts  heroes.ts  pets.ts  equipment.ts
  walls.ts        # custo por nível e quantidade por TH
  townhall.ts     # builders disponíveis, capacidade de armazém, lab level por TH
  meta.ts         # gameVersion, updatedAt, checksum
  index.ts        # API pública tipada + helpers (maxLevelForTownHall, cumulativeCost, ...)
```

Motivo de não estar no Postgres: é imutável entre releases, precisa ser tree-shakeable no cliente
(calculadoras rodam offline no PWA), e versionar em git dá diff auditável a cada balance update.

---

## 5. Índices e performance

- Dashboard: 1 query em `PlayerCurrent` (PK) — alvo < 5 ms.
- Gráfico de 90 dias: `PlayerSnapshot` por `@@index([playerId, capturedAt])`, colunas agregadas
  já materializadas — alvo < 30 ms, sem JOIN.
- Timeline: `@@index([playerId, type, at])`, paginação por cursor (`at`,`id`), nunca `OFFSET`.
- Fila de sync: índice parcial `WHERE syncEnabled` via `@@index([syncEnabled, lastSyncAt])`.
