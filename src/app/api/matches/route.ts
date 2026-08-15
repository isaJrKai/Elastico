import { NextRequest, NextResponse } from 'next/server'
import { compressedResponse, stripNulls } from '@/lib/compressed-data-stream'
import { fetchAllLiveScores, mapStatus } from '@/lib/football-data'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || undefined
    const compact = searchParams.get('compact') === 'true'

    // ── Fetch from ESPN directly ────────────────────────────────────────────
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