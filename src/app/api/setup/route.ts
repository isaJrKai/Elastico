import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Only create tables that still exist in the current Prisma schema.
// Removed: Team, Player, Match, MatchEvent, NewsItem, ApiLog
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
    CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_userId_matchId_key" ON "Vote"("userId", "matchId");
CREATE INDEX IF NOT EXISTS "Vote_matchId_idx" ON "Vote"("matchId");

CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_matchId_key" ON "Bookmark"("userId", "matchId");

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

async function checkTablesExist() {
  try {
    await db.$queryRaw`SELECT 1 FROM "User" LIMIT 1`
    return true
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

    return NextResponse.json({
      status: 'ready',
      message: 'Database is fully set up and ready. Match, team, and player data comes from ESPN.',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Database connection error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed.',
    }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    // SECURITY: Require a setup token to prevent unauthorized database resets
    const setupToken = request.headers.get('x-setup-token')
    if (setupToken !== process.env.SETUP_TOKEN) {
      return NextResponse.json({ error: 'Invalid or missing setup token. Set SETUP_TOKEN in .env and pass it via x-setup-token header.' }, { status: 403 })
    }

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl || dbUrl.startsWith('file:')) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 400 })
    }

    // Step 1: Create tables via raw SQL (only remaining tables)
    const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt)
    }

    // Step 2: Create seed users
    const ADMIN_PW = process.env.SETUP_ADMIN_PASSWORD || 'Admin' + crypto.randomUUID().slice(0, 12)
    const DEMO_PW = process.env.SETUP_DEMO_PASSWORD || 'Demo' + crypto.randomUUID().slice(0, 12)
    const adminHash = await bcrypt.hash(ADMIN_PW, 10)
    const demoHash = await bcrypt.hash(DEMO_PW, 10)

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

    if (!process.env.SETUP_ADMIN_PASSWORD) {
      console.warn(`[SETUP] Generated admin password: ${ADMIN_PW}`)
    }
    if (!process.env.SETUP_DEMO_PASSWORD) {
      console.warn(`[SETUP] Generated demo password: ${DEMO_PW}`)
    }

    // Step 3: Create system settings
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
      message: 'Database set up! Tables created and 2 seed users added. Match, team, and player data now comes from ESPN.',
    })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Setup failed.',
    }, { status: 500 })
  }
}
