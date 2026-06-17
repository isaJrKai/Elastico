import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, generateToken, hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

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

    // Successful login
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    })

    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
        failedLogins: 0,
        lockedUntil: null,
      },
    })

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        type: 'login',
        metadata: JSON.stringify({ method: 'email', ip: req.headers.get('x-forwarded-for') }),
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
      },
    })

    const { passwordHash: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}