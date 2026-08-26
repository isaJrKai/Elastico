// ELASTICO — Role-Based Access Control utilities
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

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
  try {
    const secret = assertJwtSecret()
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, secret) as { userId: string; email: string; role: string; plan: string }
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    const { db } = await import('@/lib/db')
    const user = await db.user.findUnique({ where: { id: decoded.userId } })
    if (!user || !user.isActive || user.isBanned) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    return { authorized: true, userId: decoded.userId }
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}
