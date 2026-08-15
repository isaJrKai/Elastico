import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchAllLiveScores, mapStatus } from '@/lib/football-data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const search = searchParams.get('search') || undefined
    const league = searchParams.get('league') || undefined

    // ── Try database first ────────────────────────────────────────────────
    const where: any = {}
    if (status) where.status = status
    if (league) where.competitionCode = league
    if (search) {
      where.OR = [
        { homeTeam: { name: { contains: search, mode: 'insensitive' } } },
        { awayTeam: { name: { contains: search, mode: 'insensitive' } } },
        { competition: { contains: search, mode: 'insensitive' } },
      ]
    }

    const dbMatches = await db.match.findMany({
      where,
      include: {
        homeTeam: true,
        awayTeam: true,
        events: { orderBy: { minute: 'asc' } },
      },
      orderBy: [
        { status: 'asc' }, // live/halftime first (alphabetical: 'h' > 'f' > 'u')
        { date: 'asc' },
      ],
      take: limit,
    })

    if (dbMatches.length > 0) {
      // Sort: live first, then upcoming by date, then finished by date desc
      const statusOrder: Record<string, number> = { live: 0, halftime: 1, upcoming: 2, finished: 3, postponed: 4 }
      const sorted = [...dbMatches].sort((a, b) => {
        const sa = statusOrder[a.status] ?? 5
        const sb = statusOrder[b.status] ?? 5
        if (sa !== sb) return sa - sb
        if (sa <= 1) return 0 // keep original order for live
        if (sa === 2) return (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
        return (b.date?.getTime() || 0) - (a.date?.getTime() || 0)
      })

      const matches = sorted.map(m => ({
        id: m.id,
        externalId: m.externalId,
        competition: m.competition,
        competitionCode: m.competitionCode,
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          code: m.homeTeam.code,
          logo: m.homeTeam.logo,
          primaryColor: m.homeTeam.primaryColor,
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          code: m.awayTeam.code,
          logo: m.awayTeam.logo,
          primaryColor: m.awayTeam.primaryColor,
        },
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        halfTimeHome: m.halfTimeHome,
        halfTimeAway: m.halfTimeAway,
        status: m.status,
        date: m.date?.toISOString() || null,
        venue: m.venue,
        minute: m.minute,
        events: m.events.map(e => ({
          id: e.id,
          minute: e.minute,
          type: e.type,
          detail: e.detail,
          team: e.team,
          playerName: e.playerName,
          playerPhoto: e.playerPhoto,
          assistName: e.assistName,
        })),
        source: m.source,
        lastSyncedAt: m.lastSyncedAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }))

      return NextResponse.json({ matches, source: 'database', total: dbMatches.length })
    }

    // ── Fallback: ESPN direct fetch ───────────────────────────────────────
    console.log('[Matches] DB empty, falling back to ESPN')
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
    filtered = filtered.slice(0, Math.min(limit, 200))

    const matches = filtered.map(m => ({
      id: m.id,
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
      source: 'espn',
    }))

    return NextResponse.json({ matches, source: 'espn', total: matches.length })
  } catch (error) {
    console.error('Matches list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
