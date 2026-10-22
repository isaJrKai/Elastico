import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestToken, hashSessionToken, hasValidCookieRequestOrigin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const tokenInfo = getRequestToken(req)
  if (tokenInfo?.source === 'cookie' && !hasValidCookieRequestOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  try {
    if (tokenInfo?.token && tokenInfo.token.length <= 8192) {
      await db.session.deleteMany({ where: { token: hashSessionToken(tokenInfo.token) } })
    }
    const response = NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
    response.cookies.set('elastico_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch {
    const response = NextResponse.json({ error: 'Could not revoke session' }, { status: 503 })
    response.cookies.set('elastico_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  }
}
