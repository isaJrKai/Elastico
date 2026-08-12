import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { validateEmail, validatePassword, sanitizeInput } from '@/lib/security'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`register:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 })
    }

    const body = await req.json()
    let { email, password, name } = body

    // Sanitize inputs
    if (name) name = sanitizeInput(String(name))
    if (email) email = sanitizeInput(String(email))

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Validate email format
    const emailCheck = validateEmail(email)
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 })
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

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        displayName: sanitizeInput(name || email.split('@')[0]),
      },
    })

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    })

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        type: 'login',
        metadata: JSON.stringify({ method: 'register' }),
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
      },
    })

    const { passwordHash: _, ...userWithoutPassword } = user

    return NextResponse.json(
      { user: userWithoutPassword, token },
      { status: 201 }
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}