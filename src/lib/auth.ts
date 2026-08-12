import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || ''
const JWT_MIN_LENGTH = 32
const isProduction = process.env.NODE_ENV === 'production'

// Log warning at import time, but only throw at actual usage time
// (Next.js evaluates modules during build, so we can't throw here)
if (!JWT_SECRET || JWT_SECRET.length < (isProduction ? JWT_MIN_LENGTH : 16)) {
  console.error(`[CRITICAL] JWT_SECRET must be >= ${isProduction ? JWT_MIN_LENGTH : 16} chars. Current: ${JWT_SECRET.length}. Set it in env vars.`)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: { userId: string; email: string; role: string; plan: string }): string {
  const minLen = isProduction ? JWT_MIN_LENGTH : 16
  if (!JWT_SECRET || JWT_SECRET.length < minLen) throw new Error('JWT_SECRET not configured or too short')
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' })
}

export function verifyToken(token: string): { userId: string; email: string; role: string; plan: string } {
  const minLen = isProduction ? JWT_MIN_LENGTH : 16
  if (!JWT_SECRET || JWT_SECRET.length < minLen) throw new Error('JWT_SECRET not configured or too short')
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { userId: string; email: string; role: string; plan: string }
}

export async function authenticateRequest(req: Request): Promise<
  | { user: Exclude<Awaited<ReturnType<typeof import('@/lib/db').db.user.findUnique>>, null>; req: Request }
  | Response
> {
  const { db } = await import('@/lib/db')
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
    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.isActive) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return { user, req }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
