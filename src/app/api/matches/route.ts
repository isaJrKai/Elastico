import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { compressedResponse, stripNulls } from '@/lib/compressed-data-stream'
import { fetchMatches, normalizeFDMatch, FD_COMPETITIONS } from '@/lib/football-data-org'

/**
 * GET /api/matches — Real fixtures from football-data.org, merged with DB predictions/events.
 *
 * Strategy:
 * 1. Fetch real fixtures from football-data.org (same source as standings)
 * 2. For each fixture, check DB for user predictions/events and merge
 * 3. Fall back to DB-only if API fails
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const league = searchParams.get('league') || undefined
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || undefined
    const compact = searchParams.get('compact') === 'true'

    // ── Fetch real fixtures from football-data.org ────────────────────────
    let liveMatches: ReturnType<typeof normalizeFDMatch>[] = []

    // Map league codes: PL, PD, SA, BL1, FL1, CL, EL, etc.
    const fdCode = league ? (FD_COMPETITIONS.find(c => c.code === league)?.fdCode || league) : undefined

    // Map our status to football-data.org status
    let fdStatus: string | undefined
    if (status === 'upcoming') fdStatus = 'SCHEDULED,TIMED'
    else if (status === 'live') fdStatus = 'IN_PLAY,PAUSED'
    else if (status === 'finished') fdStatus = 'FINISHED'

    // When no status specified, try SCHEDULED first, then fall back to FINISHED (off-season)
    const fetchWithStatusFallback = async (code: string) => {
      let raw = await fetchMatches(code, undefined, fdStatus)
      if (raw.length === 0 && !fdStatus && !status) {
        // Off-season: no scheduled matches, show last finished results
        raw = await fetchMatches(code, undefined, 'FINISHED')
      }
      return raw
    }

    if (fdCode) {
      // Fetch for specific league
      const raw = await fetchWithStatusFallback(fdCode)
      liveMatches = raw.map(normalizeFDMatch)
    } else {
      // Default: fetch PL (most popular), then add from other leagues if under limit
      try {
        const raw = await fetchWithStatusFallback('PL')
        liveMatches = raw.map(normalizeFDMatch)
      } catch { /* skip */ }
      // Add 1-2 more leagues if needed (respect 10 req/min rate limit)
      if (liveMatches.length < limit) {
        try {
          const raw = await fetchWithStatusFallback('CL')
          liveMatches.push(...raw.map(normalizeFDMatch))
        } catch { /* skip */ }
      }
      if (liveMatches.length < limit) {
        try {
          const raw = await fetchWithStatusFallback('PD')
          liveMatches.push(...raw.map(normalizeFDMatch))
        } catch { /* skip */ }
      }
    }

    // If search, filter live matches
    if (search) {
      const q = search.toLowerCase()
      liveMatches = liveMatches.filter(m =>
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.competition.toLowerCase().includes(q)
      )
    }

    // Sort by date (most recent first for finished, soonest first for upcoming)
    liveMatches.sort((a, b) => {
      if (status === 'finished') return new Date(b.date).getTime() - new Date(a.date).getTime()
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

    // Apply limit
    liveMatches = liveMatches.slice(0, Math.min(limit, 100))

    // ── Enrich with DB data (predictions, events, bookmarks) ──────────────
    // For each live match, check if there's a corresponding DB match with extra data
    const result = []
    for (const lm of liveMatches) {
      // Try to find DB match by the football-data.org ID stored in venue
      const dbMatch = await db.match.findFirst({
        where: { venue: lm.id },
        include: {
          _count: { select: { predictions: true, votes: true } },
        },
      })

      result.push(stripNulls({
        id: lm.id,
        competition: lm.competition,
        competitionCode: lm.competitionCode,
        competitionEmblem: lm.competitionEmblem,
        homeTeam: {
          id: lm.homeTeam.id,
          name: lm.homeTeam.name,
          code: lm.homeTeam.abbreviation,
          logo: lm.homeTeam.logo,
          primaryColor: lm.homeTeam.color,
          eloRating: dbMatch ? undefined : undefined, // Will be populated from team lookup
        },
        awayTeam: {
          id: lm.awayTeam.id,
          name: lm.awayTeam.name,
          code: lm.awayTeam.abbreviation,
          logo: lm.awayTeam.logo,
          primaryColor: lm.awayTeam.color,
          eloRating: dbMatch ? undefined : undefined,
        },
        homeScore: lm.homeScore,
        awayScore: lm.awayScore,
        halfTimeHome: lm.halfTimeHome,
        halfTimeAway: lm.halfTimeAway,
        winner: lm.winner,
        status: lm.status,
        date: lm.date,
        matchday: lm.matchday,
        odds: lm.odds,
        _count: dbMatch?._count || { predictions: 0, votes: 0 },
        source: 'football-data.org',
      }))
    }

    // ── Fall back to DB if no live matches found ──────────────────────────
    if (result.length === 0) {
      const where: Record<string, unknown> = {}
      if (status) where.status = status
      if (search) {
        where.OR = [
          { homeTeam: { name: { contains: search, mode: 'insensitive' } } },
          { awayTeam: { name: { contains: search, mode: 'insensitive' } } },
          { venue: { contains: search, mode: 'insensitive' } } as Record<string, unknown>,
        ]
      }

      const dbMatches = await db.match.findMany({
        where,
        take: Math.min(limit, 100),
        orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
        include: {
          homeTeam: { select: { id: true, name: true, code: true, logo: true, primaryColor: true, secondaryColor: true, eloRating: true } },
          awayTeam: { select: { id: true, name: true, code: true, logo: true, primaryColor: true, secondaryColor: true, eloRating: true } },
          _count: { select: { predictions: true, votes: true } },
        },
      })

      const matchIdsWithEvents = dbMatches
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

      for (const match of dbMatches) {
        result.push(stripNulls({
          ...match,
          events: eventsMap[match.id] || [],
          source: 'database',
        }))
      }
    }

    return compressedResponse(
      { matches: result, total: result.length, source: result.length > 0 && result[0]?.source === 'football-data.org' ? 'football-data.org' : 'database' },
      {
        compact,
        tag: 'MATCHES',
        cacheMaxAge: 30,
      }
    )
  } catch (error) {
    console.error('Matches list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}