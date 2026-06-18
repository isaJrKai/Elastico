import { NextRequest, NextResponse } from 'next/server'
import { fetchMatches, normalizeFDMatch, FD_COMPETITIONS } from '@/lib/football-data-org'

/**
 * GET /api/fixtures — Real fixtures directly from football-data.org.
 * Lighter than /api/matches (no DB queries, no compression layer).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const league = searchParams.get('league') || 'PL'
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Map league code
    const fdCode = FD_COMPETITIONS.find(c => c.code === league)?.fdCode || league

    // Map status
    let fdStatus: string | undefined
    if (status === 'upcoming') fdStatus = 'SCHEDULED,TIMED'
    else if (status === 'live') fdStatus = 'IN_PLAY,PAUSED'
    else if (status === 'finished') fdStatus = 'FINISHED'

    // Fetch matches
    let raw = await fetchMatches(fdCode, undefined, fdStatus)

    // Off-season fallback: if no matches and no explicit status, try FINISHED
    if (raw.length === 0 && !fdStatus) {
      raw = await fetchMatches(fdCode, undefined, 'FINISHED')
    }

    const matches = raw.map(normalizeFDMatch).slice(0, limit)

    return NextResponse.json({
      success: true,
      source: 'football-data.org',
      league: fdCode,
      total: matches.length,
      matches,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    })
  } catch (error) {
    console.error('[FIXTURES] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch fixtures' },
      { status: 500 }
    )
  }
}