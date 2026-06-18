// ELASTICO — Role-Based Access Control utilities
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || ''

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('[CRITICAL] JWT_SECRET is not set or too short (< 16 chars). Admin auth will be broken. Set it in .env')
}

export async function requireAdmin(request: Request): Promise<{ authorized: true; userId: string } | NextResponse> {
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    return NextResponse.json({ error: 'Server not configured: JWT_SECRET missing' }, { status: 500 })
  }
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string; plan: string }
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
