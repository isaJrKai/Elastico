import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_MIN_LENGTH = 32
const isProduction = process.env.NODE_ENV === 'production'

function assertJwtSecret(): string {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      `[AUTH CRITICAL] JWT_SECRET must be set in environment and be >= 32 characters. ` +
      `Current length: ${JWT_SECRET ? JWT_SECRET.length : 0}. ` +
      `Refusing to operate without a secure secret.`
    )
  }
  return JWT_SECRET
}

// ── Public User type (stripped of sensitive fields) ─────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string | null
  displayName: string | null
  avatarUrl: string | null
  role: string
  plan: string
  predictionAccuracy: number | null
  predictionStreak: number | null
  bestStreak: number | null
  totalPredictions: number | null
  correctPredictions: number | null
  achievements: string
  favoriteTeams: string
  twoFactorEnabled: boolean
  lastLoginAt: string | null
  loginCount: number | null
  createdAt: string | null
  updatedAt: string | null
  isActive: boolean
  [key: string]: unknown // Allow extra fields from DB
}

// Log at import time (build-safe). Actual enforcement happens in assertJwtSecret().
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    `[AUTH CRITICAL] JWT_SECRET is ${!JWT_SECRET ? 'not set' : 'too short (' + JWT_SECRET.length + ' chars, need >= 32)'}. ` +
    `Authentication will fail at first usage. Set it in environment variables.`
  )
}

export function toPublicUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    plan: user.plan,
    predictionAccuracy: user.predictionAccuracy ?? null,
    predictionStreak: user.predictionStreak ?? null,
    bestStreak: user.bestStreak ?? null,
    totalPredictions: user.totalPredictions ?? null,
    correctPredictions: user.correctPredictions ?? null,
    achievements: user.achievements ?? '[]',
    favoriteTeams: user.favoriteTeams ?? '[]',
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    loginCount: user.loginCount ?? null,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
    isActive: Boolean(user.isActive),
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: { userId: string; email: string; role: string; plan: string }): string {
  return jwt.sign(payload, assertJwtSecret(), { expiresIn: '7d', algorithm: 'HS256' })
}

export function verifyToken(token: string): { userId: string; email: string; role: string; plan: string } {
  return jwt.verify(token, assertJwtSecret(), { algorithms: ['HS256'] }) as { userId: string; email: string; role: string; plan: string }
}

/** Check if a real database connection is likely available */
export function isDbAvailable(): boolean {
  const url = process.env.DATABASE_URL || ''
  if (!url || url.startsWith('file:')) return false
  return true
}

export async function authenticateRequest(req: Request): Promise<
  | { user: AuthUser; req: Request }
  | Response
> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: { userId: string; email: string; role: string; plan: string }
  try {
    payload = verifyToken(authHeader.slice(7))
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Protected requests must always validate the current account against the database.
  // Never turn a database outage into an authenticated demo user.
  if (!isDbAvailable()) {
    return new Response(JSON.stringify({ error: 'Authentication service temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { db } = await import('@/lib/db')
    const user = await db.user.findUnique({ where: { id: payload.userId } })

    if (!user || !user.isActive || user.isBanned) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return { user: toPublicUser(user), req }
  } catch (dbErr) {
    console.error('[Auth] Database verification failed; protected request denied.')
    return new Response(JSON.stringify({ error: 'Authentication service temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
