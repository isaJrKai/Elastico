import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// Demo login — creates a demo user and returns a JWT.
// All demo roles are allowed for demonstration purposes.
const DEMO_ROLES: Record<string, string> = {
  free: 'free',
  pro: 'pro',
  elite: 'elite',
  admin: 'admin',
}

// Map role -> display name
const ROLE_DISPLAY: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  elite: 'Elite',
  admin: 'Admin',
}

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limiting: 5 requests per minute
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`demo:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { email, role, password } = await request.json()

    if (!email || !role || !DEMO_ROLES[role]) {
      return NextResponse.json({ error: 'Invalid demo account' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Determine actual role and plan for DB
    const actualRole = role === 'admin' ? 'admin' : 'user'
    const actualPlan = role === 'admin' ? 'elite' : role

    let user = await db.user.findUnique({ where: { email } })

    if (!user) {
      const { hash } = await import('bcryptjs')
      const hashedPassword = await hash(password, 10)
      user = await db.user.create({
        data: {
          email,
          name: `Demo ${ROLE_DISPLAY[role] || role} User`,
          passwordHash: hashedPassword,
          role: actualRole,
          plan: actualPlan,
        },
      })
    }

    const token = generateToken({ userId: user.id, email: user.email, role: actualRole, plan: actualPlan })
    const { passwordHash: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser, token })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
