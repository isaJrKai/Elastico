import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// Fields that must never be sent to the client
const SENSITIVE_FIELDS = ['passwordHash', 'twoFactorSecret', 'sessionId'] as const

type SensitiveField = (typeof SENSITIVE_FIELDS)[number]

function stripSensitive<T extends Record<string, unknown>>(obj: T): Omit<T, SensitiveField> {
  const result = { ...obj }
  for (const field of SENSITIVE_FIELDS) {
    delete result[field]
  }
  return result as Omit<T, SensitiveField>
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    return NextResponse.json({ user: stripSensitive(auth.user as Record<string, unknown>) })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
