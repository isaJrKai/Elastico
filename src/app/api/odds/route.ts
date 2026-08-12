import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/odds?competition=PL
 *
 * Aggregated odds from multiple real sources:
 * 1. API-Sports (primary — has Asian handicap, over/under, match winner)
 * 2. TheOdds API (secondary — more bookmakers, spreads = handicap)
 * 3. football-data.org (tertiary — basic odds)
 *
 * Returns unified format with source attribution.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'

    const results: any[] = []

    // ── Source 1: API-Sports ──────────────────────────────────────────────
    if (process.env.API_SPORTS_KEY) {
      try {
        const { fetchLeagueOdds, extractASOdds, AS_LEAGUES } = await import('@/lib/api-sports')
        const league = AS_LEAGUES.find(l => l.code === competition)
        if (league) {
          const odds = await fetchLeagueOdds(league.id)
          for (const o of odds.slice(0, 10)) {
            const extracted = extractASOdds(o)
            results.push({
              fixtureId: o.fixture?.id,
              source: 'api-sports',
              ...extracted,
            })
          }
        }
      } catch (err) {
        console.error('[Odds] API-Sports failed:', err)
      }
    }

    // ── Source 2: TheOdds API ────────────────────────────────────────────
    if (process.env.THE_ODDS_API_KEY) {
      try {
        const { fetchSoccerOdds, extractTheOddsData } = await import('@/lib/the-odds-api')
        const rawOdds = await fetchSoccerOdds()
        const extracted = extractTheOddsData(rawOdds)
        for (const o of extracted.slice(0, 10)) {
          results.push({
            source: 'the-odds-api',
            homeTeam: o.homeTeam,
            awayTeam: o.awayTeam,
            matchWinner: o.matchWinner,
            handicap: o.spread,
            overUnder: o.total,
          })
        }
      } catch (err) {
        console.error('[Odds] TheOdds failed:', err)
      }
    }

    // ── Source 3: football-data.org ───────────────────────────────────────
    if (process.env.FOOTBALL_DATA_API_KEY && results.length === 0) {
      try {
        const { fetchMatchesWithOdds, normalizeFDMatch, FD_COMPETITIONS } = await import('@/lib/football-data-org')
        const fdEntry = FD_COMPETITIONS.find(c => c.code === competition)
        const fdCode = fdEntry ? fdEntry.fdCode : competition
        const matches = await fetchMatchesWithOdds(fdCode)
        for (const m of matches) {
          results.push({
            source: 'football-data.org',
            homeTeam: m.homeTeam?.name,
            awayTeam: m.awayTeam?.name,
            odds: m.odds ? {
              homeWin: m.odds.matchWinner?.home,
              draw: m.odds.matchWinner?.draw,
              awayWin: m.odds.matchWinner?.away,
              asianHandicap: m.odds.asianHandicap,
            } : null,
          })
        }
      } catch (err) {
        console.error('[Odds] football-data.org failed:', err)
      }
    }

    return NextResponse.json({
      success: true,
      competition,
      count: results.length,
      sources: [
        process.env.API_SPORTS_KEY ? 'api-sports' : null,
        process.env.THE_ODDS_API_KEY ? 'the-odds-api' : null,
        process.env.FOOTBALL_DATA_API_KEY ? 'football-data.org' : null,
      ].filter(Boolean),
      data: results,
    })
  } catch (error) {
    console.error('[Odds] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}