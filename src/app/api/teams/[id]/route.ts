// DEPRECATED: Inefficient brute-force search across all leagues.
// Functionality overlaps with /api/teams (list) and /api/live?action=teams.
// No UI consumer exists. Merge into /api/teams as ?id= param or remove.

import { NextRequest, NextResponse } from 'next/server'
import { fetchTeams, fetchStandings, ESPN_LEAGUES } from '@/lib/football-data'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Search for the team across all leagues
    let foundTeam: InstanceType<typeof Object> | null = null
    let leagueCode: string | null = null

    for (const league of ESPN_LEAGUES) {
      const teams = await fetchTeams(league.code)
      const match = (teams as Array<{ id: string; name: string; abbreviation: string; logo: string; color: string; record: string }>).find(
        (t) => t.id === id || t.abbreviation === id.toUpperCase()
      )
      if (match) {
        foundTeam = match
        leagueCode = league.code
        break
      }
    }

    if (!foundTeam || !leagueCode) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Fetch standings to enrich with stats
    const standings = await fetchStandings(leagueCode)
    const standing = standings.find(
      (s) => s.code === (foundTeam as any).abbreviation
    )

    return NextResponse.json({
      team: {
        ...foundTeam,
        league: leagueCode,
        standing: standing || null,
      },
    })
  } catch (error) {
    console.error('Team detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}