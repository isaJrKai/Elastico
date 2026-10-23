-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "whatsappLink" TEXT,
    "telegramLink" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "provider" TEXT,
    "providerId" TEXT,
    "predictionAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "predictionStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalPredictions" INTEGER NOT NULL DEFAULT 0,
    "correctPredictions" INTEGER NOT NULL DEFAULT 0,
    "freeMatchesUsed" INTEGER NOT NULL DEFAULT 0,
    "achievements" TEXT NOT NULL DEFAULT '[]',
    "favoriteTeams" TEXT NOT NULL DEFAULT '[]',
    "pinnedWidgets" TEXT NOT NULL DEFAULT '[]',
    "notificationPrefs" TEXT NOT NULL DEFAULT '{}',
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "competition" TEXT NOT NULL DEFAULT '',
    "predictedHomeGoals" INTEGER NOT NULL,
    "predictedAwayGoals" INTEGER NOT NULL,
    "predictedOutcome" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'elo',
    "actualHomeGoals" INTEGER,
    "actualAwayGoals" INTEGER,
    "isCorrect" BOOLEAN,
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "note" TEXT,
    "competition" TEXT NOT NULL DEFAULT '',
    "matchDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetRole" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rollout" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "targetRoles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteTeams" TEXT NOT NULL DEFAULT '[]',
    "favoriteLeagues" TEXT NOT NULL DEFAULT '["PL","UCL"]',
    "defaultLeague" TEXT NOT NULL DEFAULT 'PL',
    "widgetLayout" TEXT,
    "alertRules" TEXT NOT NULL DEFAULT '[]',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalTeam" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortCode" TEXT,
    "leagueCode" TEXT,
    "country" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#00e676',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff',
    "eloRating" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceIdentity" (
    "id" TEXT NOT NULL,
    "canonicalTeamId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT NOT NULL,
    "leagueCode" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'EXACT',
    "resolutionMethod" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAnalytic" (
    "id" TEXT NOT NULL,
    "canonicalTeamId" TEXT,
    "teamId" TEXT,
    "source" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "leagueCode" TEXT,
    "truthClass" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "xgPerGame" DOUBLE PRECISION,
    "xgaPerGame" DOUBLE PRECISION,
    "npxGPerGame" DOUBLE PRECISION,
    "npxgaPerGame" DOUBLE PRECISION,
    "ppda" DOUBLE PRECISION,
    "ppdaAllowed" DOUBLE PRECISION,
    "deep" DOUBLE PRECISION,
    "deepAllowed" DOUBLE PRECISION,
    "sourceTeamId" TEXT,
    "sourceTeamName" TEXT,
    "dataFreshness" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamAnalytic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#00e676',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff',
    "country" TEXT,
    "league" TEXT,
    "leagueCode" TEXT,
    "founded" INTEGER,
    "venueName" TEXT,
    "venueCapacity" INTEGER,
    "eloRating" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "sourceId" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "position" TEXT,
    "age" INTEGER,
    "nationality" TEXT,
    "photo" TEXT,
    "teamId" TEXT NOT NULL,
    "number" INTEGER,
    "season" TEXT,
    "appearances" INTEGER NOT NULL DEFAULT 0,
    "minutesPlayed" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "sourceId" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "competition" TEXT NOT NULL DEFAULT '',
    "competitionCode" TEXT,
    "season" TEXT,
    "round" TEXT,
    "date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "minute" INTEGER,
    "venue" TEXT,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "halfTimeHome" INTEGER,
    "halfTimeAway" INTEGER,
    "homeXg" DOUBLE PRECISION,
    "awayXg" DOUBLE PRECISION,
    "homeXgSource" TEXT,
    "awayXgSource" TEXT,
    "homeXgTruthClass" TEXT,
    "awayXgTruthClass" TEXT,
    "possessionHome" DOUBLE PRECISION,
    "possessionAway" DOUBLE PRECISION,
    "shotsHome" INTEGER,
    "shotsAway" INTEGER,
    "shotsOnTargetHome" INTEGER,
    "shotsOnTargetAway" INTEGER,
    "cornersHome" INTEGER,
    "cornersAway" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "sourceId" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "externalId" TEXT,
    "minute" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "team" TEXT,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "playerPhoto" TEXT,
    "assistName" TEXT,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingEntry" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "teamCode" TEXT,
    "teamLogo" TEXT,
    "competition" TEXT NOT NULL,
    "competitionCode" TEXT,
    "season" TEXT,
    "rank" INTEGER NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "goalDiff" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "form" TEXT,
    "homeRecord" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'the-odds-api',
    "sportKey" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3),
    "homeWinOdds" DOUBLE PRECISION,
    "drawOdds" DOUBLE PRECISION,
    "awayWinOdds" DOUBLE PRECISION,
    "bookmaker" TEXT,
    "homeSpreadOdds" DOUBLE PRECISION,
    "awaySpreadOdds" DOUBLE PRECISION,
    "spreadLine" TEXT,
    "overOdds" DOUBLE PRECISION,
    "underOdds" DOUBLE PRECISION,
    "totalLine" TEXT,
    "rawData" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'sports',
    "imageUrl" TEXT,
    "country" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sentiment" TEXT,
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Prediction_userId_idx" ON "Prediction"("userId");

-- CreateIndex
CREATE INDEX "Prediction_matchId_idx" ON "Prediction"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_userId_matchId_key" ON "Prediction"("userId", "matchId");

-- CreateIndex
CREATE INDEX "Vote_matchId_idx" ON "Vote"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_matchId_key" ON "Vote"("userId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_matchId_key" ON "Bookmark"("userId", "matchId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_name_key" ON "FeatureFlag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "CanonicalTeam_leagueCode_idx" ON "CanonicalTeam"("leagueCode");

-- CreateIndex
CREATE INDEX "CanonicalTeam_shortCode_idx" ON "CanonicalTeam"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalTeam_displayName_leagueCode_key" ON "CanonicalTeam"("displayName", "leagueCode");

-- CreateIndex
CREATE INDEX "SourceIdentity_canonicalTeamId_idx" ON "SourceIdentity"("canonicalTeamId");

-- CreateIndex
CREATE INDEX "SourceIdentity_source_idx" ON "SourceIdentity"("source");

-- CreateIndex
CREATE INDEX "SourceIdentity_externalName_idx" ON "SourceIdentity"("externalName");

-- CreateIndex
CREATE UNIQUE INDEX "SourceIdentity_source_externalId_key" ON "SourceIdentity"("source", "externalId");

-- CreateIndex
CREATE INDEX "TeamAnalytic_teamId_idx" ON "TeamAnalytic"("teamId");

-- CreateIndex
CREATE INDEX "TeamAnalytic_canonicalTeamId_idx" ON "TeamAnalytic"("canonicalTeamId");

-- CreateIndex
CREATE INDEX "TeamAnalytic_source_leagueCode_season_idx" ON "TeamAnalytic"("source", "leagueCode", "season");

-- CreateIndex
CREATE INDEX "TeamAnalytic_truthClass_idx" ON "TeamAnalytic"("truthClass");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAnalytic_teamId_source_season_leagueCode_key" ON "TeamAnalytic"("teamId", "source", "season", "leagueCode");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAnalytic_canonicalTeamId_source_season_leagueCode_key" ON "TeamAnalytic"("canonicalTeamId", "source", "season", "leagueCode");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_leagueCode_idx" ON "Team"("leagueCode");

-- CreateIndex
CREATE UNIQUE INDEX "Team_source_sourceId_key" ON "Team"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_goals_idx" ON "Player"("goals");

-- CreateIndex
CREATE UNIQUE INDEX "Player_source_sourceId_key" ON "Player"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_date_idx" ON "Match"("date");

-- CreateIndex
CREATE INDEX "Match_competitionCode_idx" ON "Match"("competitionCode");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_source_sourceId_key" ON "Match"("source", "sourceId");

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_idx" ON "MatchEvent"("matchId");

-- CreateIndex
CREATE INDEX "MatchEvent_type_idx" ON "MatchEvent"("type");

-- CreateIndex
CREATE INDEX "StandingEntry_competitionCode_idx" ON "StandingEntry"("competitionCode");

-- CreateIndex
CREATE INDEX "StandingEntry_rank_idx" ON "StandingEntry"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "StandingEntry_competitionCode_season_teamName_key" ON "StandingEntry"("competitionCode", "season", "teamName");

-- CreateIndex
CREATE INDEX "SyncLog_source_idx" ON "SyncLog"("source");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "OddsSnapshot_sportKey_idx" ON "OddsSnapshot"("sportKey");

-- CreateIndex
CREATE INDEX "OddsSnapshot_homeTeam_idx" ON "OddsSnapshot"("homeTeam");

-- CreateIndex
CREATE INDEX "OddsSnapshot_awayTeam_idx" ON "OddsSnapshot"("awayTeam");

-- CreateIndex
CREATE INDEX "OddsSnapshot_commenceTime_idx" ON "OddsSnapshot"("commenceTime");

-- CreateIndex
CREATE INDEX "OddsSnapshot_source_fetchedAt_idx" ON "OddsSnapshot"("source", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OddsSnapshot_externalId_source_fetchedAt_key" ON "OddsSnapshot"("externalId", "source", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_externalId_key" ON "NewsArticle"("externalId");

-- CreateIndex
CREATE INDEX "NewsArticle_category_idx" ON "NewsArticle"("category");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_fetchedAt_idx" ON "NewsArticle"("fetchedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_sourceName_idx" ON "NewsArticle"("sourceName");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceIdentity" ADD CONSTRAINT "SourceIdentity_canonicalTeamId_fkey" FOREIGN KEY ("canonicalTeamId") REFERENCES "CanonicalTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAnalytic" ADD CONSTRAINT "TeamAnalytic_canonicalTeamId_fkey" FOREIGN KEY ("canonicalTeamId") REFERENCES "CanonicalTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAnalytic" ADD CONSTRAINT "TeamAnalytic_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

