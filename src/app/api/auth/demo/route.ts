import { NextRequest, NextResponse } from 'next/server'
import { generateToken, isDbAvailable } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// Demo login — creates a demo user and returns a JWT.
// All demo roles are allowed for demonstration purposes.
const DEMO_ROLES: Record<string, string> = {
  free: 'free',
  pro: 'pro',
  elite: 'elite',
  admin: 'admin',
}

// Map role -> plan (role === plan for demo)
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

    // If DB is available, try the existing DB flow
    if (isDbAvailable()) {
      try {
        const { db } = await import('@/lib/db')
        const safeRole = 'user'
        const safePlan = role === 'admin' ? 'pro' : role

        let user = await db.user.findUnique({ where: { email } })

        if (!user) {
          const hashedPassword = await import('bcryptjs').then(b => b.hash(password, 10))
          user = await db.user.create({
            data: {
              email,
              name: `Demo ${ROLE_DISPLAY[role] || role} User`,
              passwordHash: hashedPassword,
              role: safeRole,
              plan: safePlan,
            },
          })
        }

        const token = generateToken({ userId: user.id, email: user.email, role: safeRole, plan: safePlan })
        const { passwordHash: _, ...safeUser } = user
        return NextResponse.json({ user: safeUser, token })
      } catch (dbErr) {
        console.warn('[Demo Login] DB failed, using fallback:', dbErr)
      }
    }

    // Fallback: generate a fake user + token without DB
    const userId = `demo-${role}-${email.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`
    const token = generateToken({ userId, email, role, plan: role })

    const fakeUser = {
      id: userId,
      email,
      name: `Demo ${ROLE_DISPLAY[role] || role} User`,
      displayName: `${ROLE_DISPLAY[role] || role} User`,
      avatarUrl: null,
      role,
      plan: role,
      predictionAccuracy: role === 'admin' ? 78.5 : role === 'elite' ? 72.3 : role === 'pro' ? 65.1 : 50.0,
      predictionStreak: role === 'admin' ? 8 : role === 'elite' ? 5 : 3,
      bestStreak: role === 'admin' ? 15 : role === 'elite' ? 12 : 8,
      totalPredictions: role === 'admin' ? 420 : role === 'elite' ? 256 : 120,
      correctPredictions: role === 'admin' ? 330 : role === 'elite' ? 185 : 60,
      achievements: '{}',
      favoriteTeams: '[]',
      twoFactorEnabled: false,
      lastLoginAt: new Date().toISOString(),
      loginCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ user: fakeUser, token })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
