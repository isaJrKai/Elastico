import { NextRequest, NextResponse } from 'next/server'
import { fetchMatchesWithOdds, normalizeFDMatch, FD_COMPETITIONS } from '@/lib/football-data-org'

/**
 * GET /api/odds?competition=PL
 * Returns matches with real bookmaker odds from football-data.org.
 * Includes match winner odds, Asian handicap, over/under where available.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'

    if (!process.env.FOOTBALL_DATA_API_KEY) {
      return NextResponse.json({
        success: true,
        source: 'computed',
        competition,
        matches: [],
        hint: 'Set FOOTBALL_DATA_API_KEY for real bookmaker odds',
      })
    }

    const matches = await fetchMatchesWithOdds(competition)

    return NextResponse.json({
      success: true,
      source: 'football-data.org',
      competition,
      count: matches.length,
      matches: matches.map(normalizeFDMatch),
    })
  } catch (error) {
    console.error('[Odds] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}