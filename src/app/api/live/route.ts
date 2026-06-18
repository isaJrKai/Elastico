import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores, fetchLeagueScores, mapStatus, ESPN_LEAGUES } from '@/lib/football-data'

/** GET /api/live — real-time scores directly from ESPN (no DB) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const league = searchParams.get('league')
    const status = searchParams.get('status') // live, upcoming, finished

    const matches = league
      ? await fetchLeagueScores(league)
      : await fetchAllLiveScores()

    // Filter by status if requested
    const filtered = status
      ? matches.filter(m => mapStatus(m.status) === status)
      : matches

    return NextResponse.json({
      success: true,
      count: filtered.length,
      leagues: ESPN_LEAGUES.map(l => ({ code: l.code, name: l.name })),
      matches: filtered.map(m => ({
        id: m.id,
        competition: m.competition,
        homeTeam: {
          name: m.homeTeam.name,
          abbreviation: m.homeTeam.abbreviation,
          logo: m.homeTeam.logo,
          color: m.homeTeam.color,
        },
        awayTeam: {
          name: m.awayTeam.name,
          abbreviation: m.awayTeam.abbreviation,
          logo: m.awayTeam.logo,
          color: m.awayTeam.color,
        },
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: mapStatus(m.status),
        date: m.date,
        venue: m.venue,
        minute: m.minute,
      })),
    })
  } catch (error) {
    console.error('[LIVE] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

// Allow frequent caching revalidation
export const dynamic = 'force-dynamic'