import { NextResponse } from 'next/server'
import { fetchStandings as fetchFDStandings } from '@/lib/football-data-org'
import { fetchStandings as fetchESPNStandings, ESPN_LEAGUES } from '@/lib/football-data'

/**
 * GET /api/standings?competition=PL
 * Returns league table for a competition.
 * Priority: football-data.org (if API key) → ESPN (no key needed)
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'

    // ── Primary: football-data.org (if API key configured) ────────────────
    if (process.env.FOOTBALL_DATA_API_KEY) {
      try {
        const standings = await fetchFDStandings(competition)
        if (standings.length > 0) {
          const totalTable = standings[0]?.table || []
          return NextResponse.json({
            success: true,
            source: 'football-data.org',
            competition,
            standings: totalTable.map(t => ({
              position: t.position,
              team: t.team.name,
              code: t.team.tla,
              crest: t.team.crest,
              played: t.playedGames,
              won: t.won,
              drawn: t.draw,
              lost: t.lost,
              goalsFor: t.goalsFor,
              goalsAgainst: t.goalsAgainst,
              goalDifference: t.goalDifference,
              points: t.points,
              form: t.form || '',
            })),
          })
        }
      } catch (err) {
        console.warn('[Standings] football-data.org failed:', err)
      }
    }

    // ── Fallback: ESPN standings (no API key needed) ──────────────────────
    const espnStandings = await fetchESPNStandings(competition)
    if (espnStandings.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'espn',
        competition,
        standings: espnStandings.map(s => ({
          position: s.rank,
          team: s.team,
          code: s.code,
          crest: s.logo,
          played: s.played,
          won: s.wins,
          drawn: s.draws,
          lost: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDifference: s.goalDiff,
          points: s.points,
          form: s.form,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      source: 'none',
      competition,
      standings: [],
    })
  } catch (error) {
    console.error('[Standings] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
