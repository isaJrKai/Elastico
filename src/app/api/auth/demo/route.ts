import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// Demo login — creates or finds a demo user and returns a JWT.
// SECURITY: Only allows 'user' role. Requires a password. Rate-limited.
const DEMO_ROLES: Record<string, string> = {
  free: 'free',
}

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limiting: 3 requests per minute
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`demo:${ip}`, 3, 60_000)
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

    // Only allow 'user' role from the demo endpoint — no admin
    const safeRole = 'user'
    const safePlan = 'free'

    let user = await db.user.findUnique({ where: { email } })

    if (!user) {
      // Auto-create the demo user if it doesn't exist
      const hashedPassword = await import('bcryptjs').then(b => b.hash(password, 10))
      user = await db.user.create({
        data: {
          email,
          name: `Demo User`,
          passwordHash: hashedPassword,
          role: safeRole,
          plan: safePlan,
        },
      })
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role, plan: user.plan })

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser, token })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}