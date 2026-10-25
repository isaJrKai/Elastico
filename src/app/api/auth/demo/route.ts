import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// Demo accounts are for local/staging evaluation only. Never issue demo
// identities or tokens in production, and never allow role elevation here.
const DEMO_PLANS = new Set(['free', 'pro', 'elite'])

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Demo login is unavailable' }, { status: 404 })
  }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`demo:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = typeof body?.role === 'string' ? body.role : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !DEMO_PLANS.has(role)) {
      return NextResponse.json({ error: 'Invalid demo account' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Never mint a token for an existing account through the demo endpoint.
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already belongs to an account' }, { status: 409 })
    }

    const { hash } = await import('bcryptjs')
    const passwordHash = await hash(password, 10)
    const user = await db.user.create({
      data: {
        email,
        name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)} User`,
        passwordHash,
        role: 'user',
        plan: role,
      },
    })

    const token = generateToken({ userId: user.id, email: user.email, role: 'user', plan: role })
    const { passwordHash: _passwordHash, ...safeUser } = user
    return NextResponse.json({ user: safeUser, token })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
