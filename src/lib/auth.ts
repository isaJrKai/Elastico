import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_MIN_LENGTH = 32

function assertJwtSecret(): string {
  if (!JWT_SECRET || JWT_SECRET.length < JWT_MIN_LENGTH) {
    throw new Error(
      `[AUTH CRITICAL] JWT_SECRET must be set in environment and be >= ${JWT_MIN_LENGTH} characters. ` +
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
  [key: string]: unknown
}

// Log at import time (build-safe). Actual enforcement happens in assertJwtSecret().
if (!JWT_SECRET || JWT_SECRET.length < JWT_MIN_LENGTH) {
  console.error(
    `[AUTH CRITICAL] JWT_SECRET is ${!JWT_SECRET ? 'not set' : 'too short (' + JWT_SECRET.length + ' chars, need >= ' + JWT_MIN_LENGTH + ')'}. ` +
    `Authentication will fail at first usage. Set it in environment variables.`
  )
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

/** Check whether a database URL is configured; connectivity is verified by the query itself. */
export function isDbAvailable(): boolean {
  const url = process.env.DATABASE_URL || ''
  return Boolean(url && !url.startsWith('file:'))
}

function authResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function authenticateRequest(req: Request): Promise<
  | { user: AuthUser; req: Request }
  | Response
> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return authResponse(401, 'Unauthorized')
  }

  const token = authHeader.slice(7).trim()
  if (!token) return authResponse(401, 'Unauthorized')

  let payload: { userId: string; email: string; role: string; plan: string }
  try {
    payload = verifyToken(token)
  } catch {
    return authResponse(401, 'Invalid token')
  }

  // Authentication and authorization must use current database state. Never trust
  // JWT role/plan claims when the database is unavailable or a lookup fails.
  if (!isDbAvailable()) {
    return authResponse(503, 'Authentication service unavailable')
  }

  try {
    const { db } = await import('@/lib/db')
    const user = await db.user.findUnique({ where: { id: payload.userId } })

    if (!user || !(user as any).isActive) {
      return authResponse(401, 'Unauthorized')
    }

    const { passwordHash, twoFactorSecret, sessionId, ...safeUser } = user as any
    return { user: safeUser as AuthUser, req }
  } catch (dbErr) {
    console.error('[Auth] Database lookup failed; refusing authentication:', dbErr)
    return authResponse(503, 'Authentication service unavailable')
  }
}
