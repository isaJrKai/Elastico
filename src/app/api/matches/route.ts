import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { compressedResponse, stripNulls } from '@/lib/compressed-data-stream'
import { fetchAllLiveScores, mapStatus, ESPN_LEAGUES } from '@/lib/football-data'

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

    // ── Try DB first ────────────────────────────────────────────────────────
    try {
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

      // If DB returned results, use them
      if (matches.length > 0) {
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

        const result = matches.map((match) => stripNulls({
          ...match,
          events: eventsMap[match.id] || [],
        }))

        return compressedResponse(
          { matches: result, source: 'database' },
          { compact, tag: 'MATCHES', cacheMaxAge: since ? 0 : 10 }
        )
      }
    } catch (dbErr) {
      console.warn('[Matches] DB unavailable, falling back to ESPN:', dbErr)
    }

    // ── Fallback: ESPN live scores ───────────────────────────────────────────
    const espnMatches = await fetchAllLiveScores()

    let filtered = espnMatches
    if (status) {
      filtered = filtered.filter(m => mapStatus(m.status) === status)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(m =>
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.venue.toLowerCase().includes(q) ||
        m.competition.toLowerCase().includes(q)
      )
    }
    filtered = filtered.slice(0, Math.min(limit, 100))

    const result = filtered.map(m => stripNulls({
      id: m.id,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
      competition: m.competition,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        code: m.homeTeam.abbreviation,
        logo: m.homeTeam.logo,
        primaryColor: m.homeTeam.color,
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        code: m.awayTeam.abbreviation,
        logo: m.awayTeam.logo,
        primaryColor: m.awayTeam.color,
      },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: mapStatus(m.status),
      date: m.date,
      venue: m.venue,
      minute: m.minute,
      events: [],
      _count: { predictions: 0, votes: 0 },
      createdAt: m.date,
      updatedAt: new Date().toISOString(),
    }))

    return compressedResponse(
      { matches: result, source: 'espn' },
      { compact, tag: 'MATCHES-ESPN', cacheMaxAge: 15 }
    )
  } catch (error) {
    console.error('Matches list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
