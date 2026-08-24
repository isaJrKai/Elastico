import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchStandings as fetchFDStandings } from '@/lib/football-data-org'
import { fetchStandings as fetchESPNStandings } from '@/lib/football-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'
    const season = searchParams.get('season') || String(new Date().getFullYear())

    // ── Try database first ──────────────────────────────────────────────
    const dbStandings = await db.standingEntry.findMany({
      where: {
        competitionCode: competition,
        season,
      },
      orderBy: { rank: 'asc' },
    })

    if (dbStandings.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'database',
        competition,
        season,
        standings: dbStandings.map(s => ({
          rank: s.rank,
          team: s.teamName,
          code: s.teamCode || '',
          logo: s.teamLogo || '',
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDiff: s.goalDiff,
          points: s.points,
          form: s.form || '',
        })),
      })
    }

    // ── Fallback 1: football-data.org ───────────────────────────────────
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
              rank: t.position,
              team: t.team.name,
              code: t.team.tla,
              logo: t.team.crest,
              played: t.playedGames,
              wins: t.won,
              draws: t.draw,
              losses: t.lost,
              goalsFor: t.goalsFor,
              goalsAgainst: t.goalsAgainst,
              goalDiff: t.goalDifference,
              points: t.points,
              form: t.form || '',
            })),
          })
        }
      } catch (err) {
        console.warn('[Standings] football-data.org failed:', err)
      }
    }

    // ── Fallback 2: ESPN ────────────────────────────────────────────────
    const espnStandings = await fetchESPNStandings(competition)
    if (espnStandings.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'espn',
        competition,
        standings: espnStandings.map(s => ({
          rank: s.rank,
          team: s.team,
          code: s.code,
          logo: s.logo,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDiff: s.goalDiff,
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
