import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || ''

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: { userId: string; email: string; role: string; plan: string }): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set')
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; email: string; role: string; plan: string } {
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set')
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string; plan: string }
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