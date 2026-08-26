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

  const token = authHeader.slice(7)
  try {
    const payload = verifyToken(token)

    // Try DB first, fall back to token payload if DB unavailable
    if (isDbAvailable()) {
      try {
        const { db } = await import('@/lib/db')
        const user = await db.user.findUnique({ where: { id: payload.userId } })
        if (!user || !(user as any).isActive) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        // Strip sensitive fields and cast to AuthUser
        const { passwordHash, twoFactorSecret, sessionId, ...safeUser } = user as any
        return { user: safeUser as AuthUser, req }
      } catch (dbErr) {
        console.warn('[Auth] DB lookup failed, falling back to token payload:', dbErr)
      }
    }

    // Fallback: use token payload as user object (works without DB)
    const role = payload.role
    const fallbackUser: AuthUser = {
      id: payload.userId,
      email: payload.email,
      role,
      plan: payload.plan,
      name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      displayName: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      avatarUrl: null,
      predictionAccuracy: 0,
      predictionStreak: 0,
      bestStreak: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      achievements: '{}',
      favoriteTeams: '[]',
      twoFactorEnabled: false,
      lastLoginAt: new Date().toISOString(),
      loginCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    }
    return { user: fallbackUser, req }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
