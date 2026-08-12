import { PrismaClient } from '@prisma/client'

// ── Neon Postgres for production with connection pooling ──────────

function createPrismaClient() {
  const isNeon = process.env.DATABASE_URL?.includes('neon.tech')
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isNeon
      ? {
          db: {
            url: process.env.DATABASE_URL,
          },
        }
      : undefined,
    // Connection pooling for serverless — Prisma handles this via pgbouncer URL
    // Set DATABASE_URL_POOLER in Vercel env for pooled connections
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
