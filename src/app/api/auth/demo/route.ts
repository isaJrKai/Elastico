import { NextRequest, NextResponse } from 'next/server'
import { generateToken, toSafeUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { resolveDemoAccount } from '@/lib/demo-accounts'

/**
 * Public demo login is limited to three reserved, non-admin identities.
 * It never creates arbitrary emails, accepts an admin role, or authenticates a real account.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`demo:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const demo = resolveDemoAccount(body?.email, body?.role)
    if (!demo) {
      return NextResponse.json({ error: 'Invalid demo account' }, { status: 400 })
    }

    let user = await db.user.findUnique({ where: { email: demo.email } })

    if (user) {
      // A reserved demo email must never be used to sign into a real or privileged account.
      if (user.provider !== 'demo' || user.role === 'admin') {
        return NextResponse.json({ error: 'Demo account is unavailable' }, { status: 409 })
      }
      if (!user.isActive || user.isBanned) {
        return NextResponse.json({ error: 'Demo account is unavailable' }, { status: 403 })
      }
    } else {
      user = await db.user.create({
        data: {
          email: demo.email,
          name: `ELASTICO ${demo.label}`,
          displayName: demo.label,
          role: 'user',
          plan: demo.plan,
          provider: 'demo',
          passwordHash: null,
        },
      })
    }

    // Always issue claims from the stored account, never from request-controlled values.
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    })

    return NextResponse.json({ user: toSafeUser(user), token })
  } catch (error) {
    console.error('[Demo Login]', error)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
