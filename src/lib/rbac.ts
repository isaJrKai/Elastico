// ELASTICO — Role-Based Access Control utilities
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { hashSessionToken } from '@/lib/auth'

function assertJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      `[RBAC CRITICAL] JWT_SECRET must be set and be >= 32 characters. ` +
      `Current: ${!secret ? 'not set' : secret.length + ' chars'}. Admin operations disabled.`
    )
  }
  return secret
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    `[RBAC CRITICAL] JWT_SECRET is ${!process.env.JWT_SECRET ? 'not set' : 'too short (' + process.env.JWT_SECRET.length + ' chars, need >= 32)'}. ` +
    `Admin auth will fail at first usage.`
  )
}

export async function requireAdmin(request: Request): Promise<{ authorized: true; userId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  let decoded: { userId: string; email: string; role: string; plan: string }
  try {
    decoded = jwt.verify(token, assertJwtSecret(), {
      algorithms: ['HS256'],
    }) as { userId: string; email: string; role: string; plan: string }
    if (!decoded || typeof decoded.userId !== 'string' || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  try {
    const { db } = await import('@/lib/db')
    const session = await db.session.findUnique({ where: { token: hashSessionToken(token) } })
    if (!session || session.expiresAt <= new Date() || session.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Session expired or revoked' }, { status: 401 })
    }
    const user = await db.user.findUnique({ where: { id: decoded.userId } })
    if (!user || !user.isActive || user.isBanned) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    // Authorization follows the current database role, never a stale JWT claim.
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    return { authorized: true, userId: user.id }
  } catch {
    console.error('[RBAC] Database verification failed; admin request denied.')
    return NextResponse.json({ error: 'Authorization service temporarily unavailable' }, { status: 503 })
  }
}
