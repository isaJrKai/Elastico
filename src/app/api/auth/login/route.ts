import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, generateToken, hashSessionToken, hasValidCookieRequestOrigin, toPublicUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const LoginBodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
})

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin')
    if (origin && !hasValidCookieRequestOrigin(req)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = LoginBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid email and password are required' }, { status: 400 })
    }
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed, retryAfterMs } = rateLimit(`login:${ip}`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const { email, password } = parsed.data
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })
    }

    if (user.isBanned) {
      return NextResponse.json({ error: `Account is banned: ${user.banReason || 'No reason provided'}` }, { status: 403 })
    }

    // Check lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `Account is locked. Try again in ${remainingMinutes} minutes.` },
        { status: 423 }
      )
    }

    // Compare password
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'No password set for this account' }, { status: 400 })
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      const failedLogins = user.failedLogins + 1
      const updateData: Record<string, unknown> = { failedLogins }

      if (failedLogins >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 min lock
      }

      await db.user.update({ where: { id: user.id }, data: updateData })

      if (failedLogins >= 5) {
        return NextResponse.json(
          { error: 'Too many failed login attempts. Account locked for 30 minutes.' },
          { status: 423 }
        )
      }

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // A stored 2FA flag must never be ignored. Until a real challenge/verification
    // flow is implemented, fail closed rather than silently bypassing 2FA.
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor verification is not available for this account; sign-in has been blocked for safety.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Create/update the account state and session atomically.
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    })
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || undefined
    const updatedUser = await db.$transaction(async (tx) => {
      const currentUser = await tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 },
          failedLogins: 0,
          lockedUntil: null,
        },
      })
      await tx.session.create({
        data: {
          userId: user.id,
          token: hashSessionToken(token),
          ipAddress: clientIp,
          userAgent: req.headers.get('user-agent') || undefined,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      return currentUser
    })

    // Activity logging must not turn a successful login into a false failure.
    try {
      await db.activity.create({
        data: {
          userId: user.id,
          type: 'login',
          metadata: JSON.stringify({ method: 'password' }),
          ipAddress: clientIp,
        },
      })
    } catch {
      console.error('[Auth] Login activity log write failed')
    }

    const response = NextResponse.json(
      { user: toPublicUser(updatedUser) },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    )
    response.cookies.set('elastico_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
