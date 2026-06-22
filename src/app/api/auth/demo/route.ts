import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/auth'

// Demo login — no password needed. Creates or finds the demo user and returns a JWT.
// Only works if the user exists in the database (seeded via /api/setup).
const DEMO_ROLES: Record<string, string> = {
  admin: 'admin',
  pro: 'pro',
  elite: 'elite',
  free: 'free',
}

export async function POST(request: NextRequest) {
  try {
    const { email, role } = await request.json()

    if (!email || !role || !DEMO_ROLES[role]) {
      return NextResponse.json({ error: 'Invalid demo account' }, { status: 400 })
    }

    let user = await db.user.findUnique({ where: { email } })

    if (!user) {
      // Auto-create the demo user if it doesn't exist
      const hashedPassword = await import('bcryptjs').then(b => b.hash('demo', 10))
      user = await db.user.create({
        data: {
          email,
          name: `${role.charAt(0).toUpperCase() + role.slice(1)} Demo User`,
          passwordHash: hashedPassword,
          role: role as any,
          plan: role === 'admin' ? 'pro' : role,
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