import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const allowedLocales = new Set(['en', 'es', 'pt', 'fr', 'de', 'ar', 'zh', 'ja', 'ko'])
const allowedNotificationKeys = new Set([
  'goals', 'cards', 'kickoff', 'predictionResults', 'system', 'news', 'sound', 'push',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const limit = rateLimit(`profile-update:${user.id}`, 30, 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many profile updates. Try again shortly.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
      })
    }

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string' || body.displayName.trim().length > 80) {
        return NextResponse.json({ error: 'displayName must be a string of at most 80 characters' }, { status: 400 })
      }
      data.displayName = body.displayName.trim() || null
    }
    if (body.bio !== undefined) {
      if (typeof body.bio !== 'string' || body.bio.length > 500) {
        return NextResponse.json({ error: 'bio must be a string of at most 500 characters' }, { status: 400 })
      }
      data.bio = body.bio.trim()
    }
    if (body.location !== undefined) {
      if (typeof body.location !== 'string' || body.location.length > 120) {
        return NextResponse.json({ error: 'location must be a string of at most 120 characters' }, { status: 400 })
      }
      data.location = body.location.trim()
    }
    if (body.timezone !== undefined) {
      if (typeof body.timezone !== 'string' || body.timezone.length > 100) {
        return NextResponse.json({ error: 'timezone must be a valid time-zone identifier' }, { status: 400 })
      }
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: body.timezone })
      } catch {
        return NextResponse.json({ error: 'timezone must be a valid time-zone identifier' }, { status: 400 })
      }
      data.timezone = body.timezone
    }
    if (body.locale !== undefined) {
      if (typeof body.locale !== 'string' || !allowedLocales.has(body.locale)) {
        return NextResponse.json({ error: 'Unsupported language selection' }, { status: 400 })
      }
      data.locale = body.locale
    }
    if (body.favoriteTeams !== undefined) {
      if (!Array.isArray(body.favoriteTeams) || body.favoriteTeams.length > 50
        || !body.favoriteTeams.every(id => typeof id === 'string' && id.trim().length > 0 && id.length <= 200)) {
        return NextResponse.json({ error: 'favoriteTeams must be an array of up to 50 team IDs' }, { status: 400 })
      }
      data.favoriteTeams = JSON.stringify([...new Set(body.favoriteTeams as string[])])
    }
    if (body.notificationPrefs !== undefined) {
      if (!isRecord(body.notificationPrefs)
        || Object.entries(body.notificationPrefs).some(([key, value]) => !allowedNotificationKeys.has(key) || typeof value !== 'boolean')) {
        return NextResponse.json({ error: 'notificationPrefs contains unsupported or non-boolean values' }, { status: 400 })
      }
      data.notificationPrefs = JSON.stringify(body.notificationPrefs)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No supported profile fields were supplied' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        location: true,
        timezone: true,
        locale: true,
        favoriteTeams: true,
        notificationPrefs: true,
      },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error('[Profile] Update failed:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
