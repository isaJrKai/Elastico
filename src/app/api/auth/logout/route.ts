import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashSessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ success: true })
  }

  const token = authorization.slice(7)
  if (!token || token.length > 8192) {
    return NextResponse.json({ success: true })
  }

  try {
    await db.session.deleteMany({ where: { token: hashSessionToken(token) } })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not revoke session' }, { status: 503 })
  }
}
