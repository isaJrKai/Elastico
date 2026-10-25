import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// Demo account creation is development-only. Production demos must use explicitly
// provisioned, non-privileged accounts rather than accepting arbitrary identities.
const DEMO_PLANS = new Set(['free', 'pro', 'elite'])

export async function POST(request: NextRequest) {
  // Fail closed in production until a separately provisioned demo-account flow exists.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Demo login is unavailable' }, { status: 404 })
  }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`demo:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = typeof body.role === 'string' ? body.role : ''
    const password = body.password

    // The public demo flow must never mint an administrator identity.
    if (!email || !DEMO_PLANS.has(role)) {
      return NextResponse.json({ error: 'Invalid demo account' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Never issue a token for an existing account from this account-creation route.
    // In particular, do not let a caller who knows an email bypass password auth.
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'This email is already registered. Use normal login.' }, { status: 409 })
    }

    const { hash } = await import('bcryptjs')
    const hashedPassword = await hash(password, 10)
    const user = await db.user.create({
      data: {
        email,
        name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)} User`,
        passwordHash: hashedPassword,
        role: 'user',
        plan: role,
      },
    })

    const token = generateToken({ userId: user.id, email: user.email, role: 'user', plan: role })
    const { passwordHash: _passwordHash, ...safeUser } = user
    return NextResponse.json({ user: safeUser, token }, { status: 201 })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
