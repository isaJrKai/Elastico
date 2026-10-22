import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateToken, hashSessionToken, toPublicUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { validatePassword, sanitizeInput } from '@/lib/security'

const RegisterBodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  name: z.string().trim().max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
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
    const parsed = RegisterBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid email and password are required' }, { status: 400 })
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`register:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 })
    }

    let { email, password, name } = parsed.data
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return NextResponse.json({ error: 'Password must be at most 72 UTF-8 bytes' }, { status: 400 })
    }

    // Sanitize inputs
    if (name) name = sanitizeInput(String(name))
    if (email) email = sanitizeInput(String(email))

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Validate password strength
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.isStrong) {
      return NextResponse.json({ error: 'Password too weak', details: passwordCheck.feedback }, { status: 400 })
    }

    // Check if registration is open
    const registrationSetting = await db.systemSetting.findUnique({ where: { key: 'registration_open' } })
    if (registrationSetting && registrationSetting.value === 'false') {
      return NextResponse.json({ error: 'Registration is currently closed' }, { status: 403 })
    }

    // Check if email exists
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || undefined
    const { user, token } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name: name || null,
          displayName: sanitizeInput(name || email.split('@')[0]),
        },
      })

      const createdToken = generateToken({
        userId: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
        plan: createdUser.plan,
      })

      await tx.session.create({
        data: {
          userId: createdUser.id,
          token: hashSessionToken(createdToken),
          ipAddress: clientIp,
          userAgent: req.headers.get('user-agent') || undefined,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      return { user: createdUser, token: createdToken }
    })

    // Activity logs are best-effort and must not make a committed registration appear to fail.
    try {
      await db.activity.create({
        data: {
          userId: user.id,
          type: 'login',
          metadata: JSON.stringify({ method: 'register' }),
          ipAddress: clientIp,
        },
      })
    } catch {
      console.error('[Auth] Registration activity log write failed')
    }

    return NextResponse.json(
      { user: toPublicUser(user), token },
      { status: 201, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}