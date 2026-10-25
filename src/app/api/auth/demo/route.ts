import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// Demo identities are only available in non-production environments and can
// never create or impersonate administrator accounts.
const DEMO_PLANS = new Set(['free', 'pro', 'elite'])
const ROLE_DISPLAY: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  elite: 'Elite',
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`demo:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const plan = typeof body?.role === 'string' ? body.role.toLowerCase() : ''
    const password = body?.password

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !DEMO_PLANS.has(plan)) {
      return NextResponse.json({ error: 'Invalid demo account' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Password must be between 8 and 128 characters' }, { status: 400 })
    }

    // Never issue a demo token for an existing account: that would bypass its
    // actual password and account role.
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Account already exists; use normal sign-in' }, { status: 409 })
    }

    const { hash } = await import('bcryptjs')
    const passwordHash = await hash(password, 10)
    const user = await db.user.create({
      data: {
        email,
        name: `Demo ${ROLE_DISPLAY[plan]} User`,
        passwordHash,
        role: 'user',
        plan,
      },
    })

    const token = generateToken({ userId: user.id, email: user.email, role: 'user', plan })
    const safeUser = { ...user } as Record<string, unknown>
    delete safeUser.passwordHash
    return NextResponse.json({ user: safeUser, token }, { status: 201 })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
