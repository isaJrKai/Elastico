import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, comparePassword, hashPassword } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const limit = rateLimit(`password-change:${user.id}`, 5, 15 * 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many password change attempts. Try again later.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
      })
    }

    const body: unknown = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }
    const { currentPassword, newPassword } = body as { currentPassword?: unknown; newPassword?: unknown }
    if (typeof currentPassword !== 'string' || !currentPassword
      || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json({ error: 'Current password is required and new password must be 8–128 characters' }, { status: 400 })
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'New password must differ from the current password' }, { status: 400 })
    }

    const account = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
    if (!account?.passwordHash) {
      return NextResponse.json({ error: 'Password changes are unavailable for accounts without a password login' }, { status: 400 })
    }
    if (!(await comparePassword(currentPassword, account.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const passwordHash = await hashPassword(newPassword)
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })
    await db.activity.create({
      data: {
        userId: user.id,
        type: 'password_change',
        metadata: JSON.stringify({ method: 'authenticated-settings' }),
      },
    })

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('[PasswordChange] Update failed:', error)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}
