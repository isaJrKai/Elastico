import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripNulls } from '@/lib/compressed-data-stream'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const stage = searchParams.get('stage') || undefined
    const group = searchParams.get('group') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || undefined
    const compact = searchParams.get('compact') === 'true'
    const since = searchParams.get('since')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (stage) where.stage = stage
    if (group) where.group = group
    if (search) {
      where.OR = [
        { homeTeam: { name: { contains: search, mode: 'insensitive' } } },
        { awayTeam: { name: { contains: search, mode: 'insensitive' } } },
        { venue: { contains: search, mode: 'insensitive' } },
      ]
    }

    // If 'since' timestamp is provided, only return recently modified matches (diff mode)
    if (since) {
      const sinceDate = new Date(parseInt(since, 10))
      if (!isNaN(sinceDate.getTime())) {
        ;(where as Record<string, unknown>).updatedAt = { gte: sinceDate }
      }
    }

    const matches = await db.match.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
      include: {
        homeTeam: { select: { id: true, name: true, code: true, logo: true, primaryColor: true, secondaryColor: true, eloRating: true } },
        awayTeam: { select: { id: true, name: true, code: true, logo: true, primaryColor: true, secondaryColor: true, eloRating: true } },
        _count: { select: { predictions: true, votes: true } },
      },
    })

    // For non-upcoming matches, include events
    const matchIdsWithEvents = matches
      .filter((m) => m.status !== 'upcoming')
      .map((m) => m.id)

    const eventsMap: Record<string, unknown[]> = {}
    if (matchIdsWithEvents.length > 0) {
      const events = await db.matchEvent.findMany({
        where: { matchId: { in: matchIdsWithEvents } },
        orderBy: { minute: 'asc' },
      })
      for (const event of events) {
        if (!eventsMap[event.matchId]) eventsMap[event.matchId] = []
        eventsMap[event.matchId].push(event)
      }
    }

    // Strip nulls for lightweight payload (biggest savings — 30–60% null padding)
    const result = matches.map((match) => stripNulls({
      ...match,
      events: eventsMap[match.id] || [],
    }))

    // Cache for 30s on CDN to reduce cold starts — stale-while-revalidate
    const response = NextResponse.json({ matches: result })
    if (!since) {
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    }
    return response
  } catch (error) {
    console.error('Matches list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}