import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// SQL to create all tables (mirrors Prisma schema for PostgreSQL)
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#00e676',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff',
    "eloRating" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "eloHistory" TEXT NOT NULL DEFAULT '[]',
    "form" TEXT NOT NULL DEFAULT '[]',
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "group" TEXT,
    "rank" INTEGER,
    "coachName" TEXT,
    "style" TEXT,
    "xgPerGame" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "xgaPerGame" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "possession" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "passAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "pressIntensity" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Team_code_key" ON "Team"("code");
CREATE INDEX IF NOT EXISTS "Team_eloRating_idx" ON "Team"("eloRating");
CREATE INDEX IF NOT EXISTS "Team_group_idx" ON "Team"("group");

CREATE TABLE IF NOT EXISTS "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "appearances" INTEGER NOT NULL DEFAULT 0,
    "minutesPlayed" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "marketValue" DOUBLE PRECISION,
    "age" INTEGER,
    "nationality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Player_teamId_idx" ON "Player"("teamId");
CREATE INDEX IF NOT EXISTS "Player_goals_idx" ON "Player"("goals");

CREATE TABLE IF NOT EXISTS "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "competition" TEXT NOT NULL DEFAULT 'World Cup 2026',
    "stage" TEXT NOT NULL DEFAULT 'Group Stage',
    "group" TEXT,
    "matchday" INTEGER,
    "date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "homeXg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "awayXg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "possessionHome" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "possessionAway" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "shotsHome" INTEGER NOT NULL DEFAULT 0,
    "shotsAway" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTargetHome" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTargetAway" INTEGER NOT NULL DEFAULT 0,
    "cornersHome" INTEGER NOT NULL DEFAULT 0,
    "cornersAway" INTEGER NOT NULL DEFAULT 0,
    "foulsHome" INTEGER NOT NULL DEFAULT 0,
    "foulsAway" INTEGER NOT NULL DEFAULT 0,
    "offsidesHome" INTEGER NOT NULL DEFAULT 0,
    "offsidesAway" INTEGER NOT NULL DEFAULT 0,
    "attendance" INTEGER,
    "venue" TEXT,
    "weather" TEXT,
    "temperature" DOUBLE PRECISION,
    "homeWinProb" DOUBLE PRECISION,
    "drawProb" DOUBLE PRECISION,
    "awayWinProb" DOUBLE PRECISION,
    "overUnderProb" TEXT,
    "homeEloBefore" DOUBLE PRECISION,
    "awayEloBefore" DOUBLE PRECISION,
    "eloPrediction" TEXT,
    "poissonMatrix" TEXT,
    "dixonColes" TEXT,
    "monteCarlo" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "simulationMinute" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Match_status_idx" ON "Match"("status");
CREATE INDEX IF NOT EXISTS "Match_date_idx" ON "Match"("date");
CREATE INDEX IF NOT EXISTS "Match_stage_idx" ON "Match"("stage");

CREATE TABLE IF NOT EXISTS "MatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MatchEvent_matchId_idx" ON "MatchEvent"("matchId");
CREATE INDEX IF NOT EXISTS "MatchEvent_type_idx" ON "MatchEvent"("type");

CREATE TABLE IF NOT EXISTS "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "predictedHomeGoals" INTEGER NOT NULL,
    "predictedAwayGoals" INTEGER NOT NULL,
    "predictedOutcome" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'elo',
    "isCorrect" BOOLEAN,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Prediction_userId_matchId_key" ON "Prediction"("userId", "matchId");
CREATE INDEX IF NOT EXISTS "Prediction_userId_idx" ON "Prediction"("userId");
CREATE INDEX IF NOT EXISTS "Prediction_matchId_idx" ON "Prediction"("matchId");

CREATE TABLE IF NOT EXISTS "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_userId_matchId_key" ON "Vote"("userId", "matchId");
CREATE INDEX IF NOT EXISTS "Vote_matchId_idx" ON "Vote"("matchId");

CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_matchId_key" ON "Bookmark"("userId", "matchId");

CREATE TABLE IF NOT EXISTS "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "source" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "imageUrl" TEXT,
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "relatedTeams" TEXT NOT NULL DEFAULT '[]',
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarked" TEXT NOT NULL DEFAULT '[]',
    "reactions" TEXT NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Activity_userId_idx" ON "Activity"("userId");
CREATE INDEX IF NOT EXISTS "Activity_type_idx" ON "Activity"("type");
CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON "Activity"("createdAt");

CREATE TABLE IF NOT EXISTS "ApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ApiLog_method_idx" ON "ApiLog"("method");
CREATE INDEX IF NOT EXISTS "ApiLog_path_idx" ON "ApiLog"("path");
CREATE INDEX IF NOT EXISTS "ApiLog_statusCode_idx" ON "ApiLog"("statusCode");
CREATE INDEX IF NOT EXISTS "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");

CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");

CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetRole" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rollout" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "targetRoles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlag_name_key" ON "FeatureFlag"("name");

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
`

const TEAMS = [
  { name: 'United States', code: 'USA', group: 'A', primaryColor: '#002868', secondaryColor: '#BF0A30', coachName: 'Mauricio Pochettino', style: 'attacking', xgPerGame: 1.45, xgaPerGame: 0.95, possession: 55, passAccuracy: 84, pressIntensity: 62, eloRating: 1660, rank: 13 },
  { name: 'Mexico', code: 'MEX', group: 'A', primaryColor: '#006847', secondaryColor: '#FFFFFF', coachName: 'Javier Aguirre', style: 'balanced', xgPerGame: 1.30, xgaPerGame: 1.10, possession: 52, passAccuracy: 82, pressIntensity: 58, eloRating: 1640, rank: 15 },
  { name: 'Brazil', code: 'BRA', group: 'D', primaryColor: '#009C3B', secondaryColor: '#FFDF00', coachName: 'Dorival Junior', style: 'attacking', xgPerGame: 1.80, xgaPerGame: 0.85, possession: 58, passAccuracy: 86, pressIntensity: 65, eloRating: 1840, rank: 5 },
  { name: 'Argentina', code: 'ARG', group: 'B', primaryColor: '#75AADB', secondaryColor: '#FFFFFF', coachName: 'Lionel Scaloni', style: 'balanced', xgPerGame: 1.75, xgaPerGame: 0.80, possession: 57, passAccuracy: 85, pressIntensity: 63, eloRating: 1910, rank: 1 },
  { name: 'France', code: 'FRA', group: 'C', primaryColor: '#002395', secondaryColor: '#ED2939', coachName: 'Didier Deschamps', style: 'balanced', xgPerGame: 1.70, xgaPerGame: 0.82, possession: 56, passAccuracy: 85, pressIntensity: 64, eloRating: 1870, rank: 2 },
  { name: 'England', code: 'ENG', group: 'C', primaryColor: '#FFFFFF', secondaryColor: '#CF081F', coachName: 'Thomas Tuchel', style: 'attacking', xgPerGame: 1.65, xgaPerGame: 0.88, possession: 58, passAccuracy: 87, pressIntensity: 66, eloRating: 1850, rank: 4 },
  { name: 'Spain', code: 'ESP', group: 'B', primaryColor: '#C60B1E', secondaryColor: '#FFC400', coachName: 'Luis de la Fuente', style: 'attacking', xgPerGame: 1.85, xgaPerGame: 0.75, possession: 62, passAccuracy: 89, pressIntensity: 68, eloRating: 1890, rank: 3 },
  { name: 'Germany', code: 'GER', group: 'A', primaryColor: '#000000', secondaryColor: '#DD0000', coachName: 'Julian Nagelsmann', style: 'attacking', xgPerGame: 1.72, xgaPerGame: 0.90, possession: 60, passAccuracy: 87, pressIntensity: 67, eloRating: 1830, rank: 6 },
  { name: 'Portugal', code: 'POR', group: 'D', primaryColor: '#006600', secondaryColor: '#FF0000', coachName: 'Roberto Martinez', style: 'attacking', xgPerGame: 1.68, xgaPerGame: 0.87, possession: 58, passAccuracy: 86, pressIntensity: 64, eloRating: 1820, rank: 7 },
  { name: 'Netherlands', code: 'NED', group: 'D', primaryColor: '#FF6600', secondaryColor: '#FFFFFF', coachName: 'Ronald Koeman', style: 'balanced', xgPerGame: 1.60, xgaPerGame: 0.92, possession: 56, passAccuracy: 85, pressIntensity: 62, eloRating: 1790, rank: 8 },
  { name: 'Italy', code: 'ITA', group: 'B', primaryColor: '#0066CC', secondaryColor: '#FFFFFF', coachName: 'Luciano Spalletti', style: 'defensive', xgPerGame: 1.50, xgaPerGame: 0.78, possession: 54, passAccuracy: 84, pressIntensity: 60, eloRating: 1770, rank: 9 },
  { name: 'Japan', code: 'JPN', group: 'C', primaryColor: '#000080', secondaryColor: '#FFFFFF', coachName: 'Hajime Moriyasu', style: 'balanced', xgPerGame: 1.35, xgaPerGame: 1.05, possession: 52, passAccuracy: 83, pressIntensity: 65, eloRating: 1680, rank: 14 },
  { name: 'South Korea', code: 'KOR', group: 'C', primaryColor: '#CD2E3A', secondaryColor: '#0047A0', coachName: 'Hong Myung-bo', style: 'balanced', xgPerGame: 1.25, xgaPerGame: 1.15, possession: 50, passAccuracy: 81, pressIntensity: 63, eloRating: 1650, rank: 16 },
  { name: 'Canada', code: 'CAN', group: 'A', primaryColor: '#FF0000', secondaryColor: '#FFFFFF', coachName: 'Mauro Biello', style: 'balanced', xgPerGame: 1.20, xgaPerGame: 1.20, possession: 48, passAccuracy: 80, pressIntensity: 60, eloRating: 1610, rank: 18 },
  { name: 'Australia', code: 'AUS', group: 'B', primaryColor: '#FFCD00', secondaryColor: '#00843D', coachName: 'Tony Popovic', style: 'balanced', xgPerGame: 1.18, xgaPerGame: 1.25, possession: 47, passAccuracy: 79, pressIntensity: 61, eloRating: 1590, rank: 22 },
  { name: 'Uruguay', code: 'URU', group: 'D', primaryColor: '#5CBFEB', secondaryColor: '#001489', coachName: 'Marcelo Bielsa', style: 'defensive', xgPerGame: 1.40, xgaPerGame: 0.90, possession: 50, passAccuracy: 82, pressIntensity: 64, eloRating: 1750, rank: 11 },
]

const MATCHES = [
  { homeTeamCode: 'USA', awayTeamCode: 'CAN', stage: 'Group Stage', group: 'A', date: '2026-06-11T18:00:00Z' },
  { homeTeamCode: 'MEX', awayTeamCode: 'GER', stage: 'Group Stage', group: 'A', date: '2026-06-11T21:00:00Z' },
  { homeTeamCode: 'GER', awayTeamCode: 'USA', stage: 'Group Stage', group: 'A', date: '2026-06-17T18:00:00Z' },
  { homeTeamCode: 'CAN', awayTeamCode: 'MEX', stage: 'Group Stage', group: 'A', date: '2026-06-17T21:00:00Z' },
  { homeTeamCode: 'ARG', awayTeamCode: 'ITA', stage: 'Group Stage', group: 'B', date: '2026-06-12T18:00:00Z' },
  { homeTeamCode: 'ESP', awayTeamCode: 'AUS', stage: 'Group Stage', group: 'B', date: '2026-06-12T21:00:00Z' },
  { homeTeamCode: 'FRA', awayTeamCode: 'KOR', stage: 'Group Stage', group: 'C', date: '2026-06-13T18:00:00Z' },
  { homeTeamCode: 'ENG', awayTeamCode: 'JPN', stage: 'Group Stage', group: 'C', date: '2026-06-13T21:00:00Z' },
  { homeTeamCode: 'BRA', awayTeamCode: 'URU', stage: 'Group Stage', group: 'D', date: '2026-06-14T18:00:00Z' },
  { homeTeamCode: 'POR', awayTeamCode: 'NED', stage: 'Group Stage', group: 'D', date: '2026-06-14T21:00:00Z' },
]

const NEWS = [
  { title: 'Argentina confirmed as World Cup 2026 top seeds', summary: 'Following their Copa America triumph, Argentina retains the #1 spot in FIFA rankings.', category: 'match', isBreaking: true, sentiment: 'positive', source: 'FIFA.com' },
  { title: 'Brazil announce final 26-man squad', summary: 'Dorival Junior has named his squad with several surprise inclusions from the Brazilian league.', category: 'transfer', isBreaking: false, sentiment: 'neutral', source: 'Globo Esporte' },
  { title: 'England vs Japan preview: Tactical breakdown', summary: 'Tuchel faces his biggest test as England manager against a technically gifted Japan side.', category: 'tactical', isBreaking: false, sentiment: 'neutral', source: 'ELASTICO Analysis' },
  { title: 'USA-Mexico rivalry renewed in World Cup opener', summary: 'The CONCACAF giants meet on the biggest stage in what promises to be a fiery Group A encounter.', category: 'match', isBreaking: true, sentiment: 'positive', source: 'ESPN FC' },
  { title: 'Key injuries ahead of the tournament', summary: 'Several star players are racing against time to be fit for the World Cup kickoff.', category: 'injury', isBreaking: false, sentiment: 'negative', source: 'The Athletic' },
]

async function checkTablesExist() {
  try {
    await db.$queryRaw`SELECT 1 FROM "User" LIMIT 1`
    return true
  } catch {
    return false
  }
}

async function checkHasData() {
  try {
    const count = await db.team.count()
    return count > 0
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL

    // Check if DATABASE_URL is configured
    if (!dbUrl || dbUrl.startsWith('file:')) {
      return NextResponse.json({
        status: 'needs_database',
        message: 'DATABASE_URL environment variable is not configured. Add a Postgres database on Vercel Storage tab.',
      })
    }

    // Check if we can connect
    await db.$queryRaw`SELECT 1`

    // Check if tables exist
    const tablesExist = await checkTablesExist()
    if (!tablesExist) {
      return NextResponse.json({
        status: 'needs_setup',
        message: 'Database connected but tables not created. Run POST /api/setup to create tables and seed data.',
      })
    }

    // Check if data exists
    const hasData = await checkHasData()
    if (!hasData) {
      return NextResponse.json({
        status: 'needs_seed',
        message: 'Tables exist but no data. Run POST /api/setup to seed.',
      })
    }

    return NextResponse.json({
      status: 'ready',
      message: 'Database is fully set up and ready.',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      status: 'error',
      message: `Database connection failed: ${msg}`,
    }, { status: 503 })
  }
}

export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl || dbUrl.startsWith('file:')) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 400 })
    }

    // Step 1: Create tables via raw SQL
    const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt)
    }

    // Step 2: Check if data already exists
    const existingTeams = await db.team.count()
    if (existingTeams > 0) {
      return NextResponse.json({
        status: 'already_seeded',
        message: `Database already has ${existingTeams} teams. Skipping seed.`,
      })
    }

    // Step 3: Create users
    const adminHash = await bcrypt.hash('admin123', 10)
    const demoHash = await bcrypt.hash('demo123', 10)

    await db.user.upsert({
      where: { email: 'admin@elastico.app' },
      update: {},
      create: {
        email: 'admin@elastico.app',
        passwordHash: adminHash,
        name: 'ELASTICO Admin',
        displayName: 'Admin',
        role: 'admin',
        plan: 'elite',
      },
    })

    await db.user.upsert({
      where: { email: 'demo@elastico.app' },
      update: {},
      create: {
        email: 'demo@elastico.app',
        passwordHash: demoHash,
        name: 'Demo User',
        displayName: 'Demo',
        role: 'user',
        plan: 'free',
      },
    })

    // Step 4: Create teams and build ID map
    const teamMap = new Map<string, string>()
    for (const t of TEAMS) {
      const team = await db.team.create({
        data: { ...t, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
      })
      teamMap.set(t.code, team.id)
    }

    // Step 5: Create matches
    for (const m of MATCHES) {
      const homeId = teamMap.get(m.homeTeamCode)!
      const awayId = teamMap.get(m.awayTeamCode)!
      const homeTeam = TEAMS.find(t => t.code === m.homeTeamCode)!
      const awayTeam = TEAMS.find(t => t.code === m.awayTeamCode)!
      const eloDiff = homeTeam.eloRating - awayTeam.eloRating
      const homeWinProb = 1 / (1 + Math.pow(10, -eloDiff / 400))
      const drawProb = 0.26
      const awayWinProb = 1 - homeWinProb - drawProb

      await db.match.create({
        data: {
          homeTeamId: homeId,
          awayTeamId: awayId,
          stage: m.stage,
          group: m.group,
          date: new Date(m.date),
          status: 'upcoming',
          homeWinProb: Math.round(homeWinProb * 1000) / 1000,
          drawProb: Math.round(drawProb * 1000) / 1000,
          awayWinProb: Math.round(awayWinProb * 1000) / 1000,
          homeEloBefore: homeTeam.eloRating,
          awayEloBefore: awayTeam.eloRating,
        },
      })
    }

    // Step 6: Create news
    for (const n of NEWS) {
      await db.newsItem.create({
        data: { ...n, publishedAt: new Date() },
      })
    }

    // Step 7: Create system settings
    await db.systemSetting.upsert({
      where: { key: 'site_name' },
      update: {},
      create: { key: 'site_name', value: 'ELASTICO', type: 'string' },
    })
    await db.systemSetting.upsert({
      where: { key: 'prediction_engine' },
      update: {},
      create: { key: 'prediction_engine', value: 'ensemble', type: 'string' },
    })

    return NextResponse.json({
      status: 'success',
      message: `Database set up! ${TEAMS.length} teams, ${MATCHES.length} matches, ${NEWS.length} news, 2 users created.`,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Setup error:', error)
    return NextResponse.json({
      status: 'error',
      message: `Setup failed: ${msg}`,
    }, { status: 500 })
  }
}