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
  const jsonError = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonError('Unauthorized', 401)

  const token = authHeader.slice(7)
  let payload: ReturnType<typeof verifyToken>
  try {
    payload = verifyToken(token)
  } catch {
    return jsonError('Invalid token', 401)
  }

  // Authorization must always be grounded in current database state. A signed
  // JWT is not a substitute for an account-status/role lookup.
  if (!isDbAvailable()) return jsonError('Authentication service temporarily unavailable', 503)

  try {
    const { db } = await import('@/lib/db')
    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user || !(user as any).isActive) return jsonError('Unauthorized', 401)

    const {
      passwordHash,
      twoFactorSecret,
      sessionId,
      ...safeUser
    } = user as any
    return { user: safeUser as AuthUser, req }
  } catch (error) {
    console.error('[Auth] Database verification failed; refusing token fallback.', error)
    return jsonError('Authentication service temporarily unavailable', 503)
  }
}
