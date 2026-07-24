-- CreateEnum
CREATE TYPE "PlannerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'LEGEND');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'OK', 'NOT_FOUND', 'THROTTLED', 'MAINTENANCE', 'ERROR');

-- CreateEnum
CREATE TYPE "SnapshotKind" AS ENUM ('DAILY', 'SEASON_END', 'MANUAL', 'MIGRATION');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('API', 'MANUAL', 'INFERRED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UnitCategory" AS ENUM ('TROOP', 'SPELL', 'HERO', 'PET', 'EQUIPMENT', 'SIEGE', 'BUILDING', 'WALL', 'TRAP');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TH_UP', 'HERO_LEVEL_UP', 'TROOP_LEVEL_UP', 'SPELL_LEVEL_UP', 'PET_LEVEL_UP', 'EQUIPMENT_LEVEL_UP', 'BUILDING_LEVEL_UP', 'WALL_BATCH', 'LEAGUE_CHANGE', 'TROPHY_PEAK', 'ACHIEVEMENT_TIER', 'CLAN_CHANGE', 'JOB_STARTED', 'JOB_FINISHED', 'IDLE_DETECTED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('BUILDING', 'LAB', 'HERO', 'PET', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Resource" AS ENUM ('GOLD', 'ELIXIR', 'DARK_ELIXIR', 'GEMS');

-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('TH_LEVEL', 'HERO_LEVEL', 'LAB_COMPLETION', 'WALL_COMPLETION', 'VILLAGE_SCORE', 'MAX_PROGRESS', 'TROPHIES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "AchievementTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BUILDER_FREE', 'LAB_DONE', 'JOB_DONE', 'RESOURCES_FULL', 'SHIELD_END', 'BOOST_END', 'SEASON_END', 'CWL_START', 'CLAN_GAMES', 'CAPITAL_RAID', 'WAR_ATTACK_PENDING', 'IDLE_NUDGE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "plannerTier" "PlannerTier" NOT NULL DEFAULT 'BRONZE',
    "plannerXp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncPriority" INTEGER NOT NULL DEFAULT 0,
    "builders" INTEGER NOT NULL DEFAULT 5,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCurrent" (
    "playerId" TEXT NOT NULL,
    "townHallLevel" INTEGER NOT NULL,
    "townHallWeapon" INTEGER,
    "expLevel" INTEGER NOT NULL,
    "trophies" INTEGER NOT NULL,
    "bestTrophies" INTEGER NOT NULL,
    "leagueId" INTEGER,
    "leagueName" TEXT,
    "warStars" INTEGER NOT NULL,
    "attackWins" INTEGER NOT NULL,
    "defenseWins" INTEGER NOT NULL,
    "donations" INTEGER NOT NULL,
    "donationsReceived" INTEGER NOT NULL,
    "clanTag" TEXT,
    "clanName" TEXT,
    "builderHallLevel" INTEGER,
    "builderTrophies" INTEGER,
    "capitalContributions" INTEGER NOT NULL DEFAULT 0,
    "units" JSONB NOT NULL,
    "achievements" JSONB NOT NULL,
    "villageScore" INTEGER,
    "maxProgressBp" INTEGER,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    "scoreBreakdown" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCurrent_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "PlayerSnapshot" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedOn" DATE NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "kind" "SnapshotKind" NOT NULL DEFAULT 'DAILY',
    "townHallLevel" INTEGER NOT NULL,
    "expLevel" INTEGER NOT NULL,
    "trophies" INTEGER NOT NULL,
    "bestTrophies" INTEGER NOT NULL,
    "leagueId" INTEGER,
    "warStars" INTEGER NOT NULL,
    "attackWins" INTEGER NOT NULL,
    "defenseWins" INTEGER NOT NULL,
    "donations" INTEGER NOT NULL,
    "donationsReceived" INTEGER NOT NULL,
    "clanTag" TEXT,
    "builderHallLevel" INTEGER,
    "builderTrophies" INTEGER,
    "villageScore" INTEGER,
    "maxProgressBp" INTEGER,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    "heroSumLevel" INTEGER,
    "labProgressBp" INTEGER,
    "goldLootTotal" BIGINT,
    "elixirLootTotal" BIGINT,
    "darkLootTotal" BIGINT,
    "units" JSONB NOT NULL,

    CONSTRAINT "PlayerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSnapshotRaw" (
    "snapshotId" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "gameVersion" TEXT,

    CONSTRAINT "PlayerSnapshotRaw_pkey" PRIMARY KEY ("snapshotId")
);

-- CreateTable
CREATE TABLE "ProgressEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "EventType" NOT NULL,
    "key" TEXT,
    "category" "UnitCategory",
    "fromLevel" INTEGER,
    "toLevel" INTEGER,
    "delta" INTEGER,
    "meta" JSONB,
    "source" "DataSource" NOT NULL DEFAULT 'API',

    CONSTRAINT "ProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageBuilding" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "buildingKey" TEXT NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpgradeJob" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "fromLevel" INTEGER NOT NULL,
    "toLevel" INTEGER NOT NULL,
    "builderNo" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "costAmount" BIGINT NOT NULL,
    "costType" "Resource" NOT NULL,
    "usedBook" BOOLEAN NOT NULL DEFAULT false,
    "usedHammer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UpgradeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "targetKey" TEXT,
    "targetValue" INTEGER NOT NULL,
    "baselineValue" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementDef" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "tier" "AchievementTier" NOT NULL,
    "xp" INTEGER NOT NULL,
    "rule" JSONB NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AchievementDef_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UnlockedAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "playerId" TEXT,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "UnlockedAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dataRef" JSONB,
    "actionKey" TEXT,
    "createdOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOkAt" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPref" (
    "userId" TEXT NOT NULL,
    "builderFree" BOOLEAN NOT NULL DEFAULT true,
    "labDone" BOOLEAN NOT NULL DEFAULT true,
    "warAttack" BOOLEAN NOT NULL DEFAULT true,
    "seasonEnd" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "quietFrom" INTEGER,
    "quietTo" INTEGER,

    CONSTRAINT "NotificationPref_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AdvisorThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "contextHash" TEXT,
    "provider" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Player_tag_idx" ON "Player"("tag");

-- CreateIndex
CREATE INDEX "Player_syncEnabled_lastSyncAt_idx" ON "Player"("syncEnabled", "lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_tag_key" ON "Player"("userId", "tag");

-- CreateIndex
CREATE INDEX "PlayerSnapshot_playerId_capturedAt_idx" ON "PlayerSnapshot"("playerId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSnapshot_playerId_capturedOn_key" ON "PlayerSnapshot"("playerId", "capturedOn");

-- CreateIndex
CREATE INDEX "ProgressEvent_playerId_at_idx" ON "ProgressEvent"("playerId", "at");

-- CreateIndex
CREATE INDEX "ProgressEvent_playerId_type_at_idx" ON "ProgressEvent"("playerId", "type", "at");

-- CreateIndex
CREATE INDEX "VillageBuilding_playerId_idx" ON "VillageBuilding"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "VillageBuilding_playerId_buildingKey_slot_key" ON "VillageBuilding"("playerId", "buildingKey", "slot");

-- CreateIndex
CREATE INDEX "UpgradeJob_playerId_status_endsAt_idx" ON "UpgradeJob"("playerId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "Goal_playerId_status_idx" ON "Goal"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockedAchievement_userId_key_key" ON "UnlockedAchievement"("userId", "key");

-- CreateIndex
CREATE INDEX "Insight_playerId_createdAt_idx" ON "Insight"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Insight_playerId_kind_createdOn_key" ON "Insight"("playerId", "kind", "createdOn");

-- CreateIndex
CREATE INDEX "Alert_status_fireAt_idx" ON "Alert"("status", "fireAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "AdvisorThread_userId_createdAt_idx" ON "AdvisorThread"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvisorMessage_threadId_createdAt_idx" ON "AdvisorMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCurrent" ADD CONSTRAINT "PlayerCurrent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSnapshot" ADD CONSTRAINT "PlayerSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSnapshotRaw" ADD CONSTRAINT "PlayerSnapshotRaw_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PlayerSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEvent" ADD CONSTRAINT "ProgressEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageBuilding" ADD CONSTRAINT "VillageBuilding_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpgradeJob" ADD CONSTRAINT "UpgradeJob_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockedAchievement" ADD CONSTRAINT "UnlockedAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockedAchievement" ADD CONSTRAINT "UnlockedAchievement_key_fkey" FOREIGN KEY ("key") REFERENCES "AchievementDef"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPref" ADD CONSTRAINT "NotificationPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorThread" ADD CONSTRAINT "AdvisorThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorMessage" ADD CONSTRAINT "AdvisorMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AdvisorThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
