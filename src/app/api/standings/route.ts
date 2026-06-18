import { NextResponse } from 'next/server'
import { fetchStandings } from '@/lib/football-data-org'

/**
 * GET /api/standings?competition=PL
 * Returns league table for a competition from football-data.org.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'

    if (!process.env.FOOTBALL_DATA_API_KEY) {
      return NextResponse.json({
        success: true,
        source: 'none',
        competition,
        standings: [],
        hint: 'Set FOOTBALL_DATA_API_KEY for real standings data',
      })
    }

    const standings = await fetchStandings(competition)
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