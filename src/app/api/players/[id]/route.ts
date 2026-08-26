// DEPRECATED: Broken implementation — searches by name across league leaders,
// not by ID. Treats 'id' param as either a player name or team ID unpredictably.
// Overlaps with /api/players (list) and /api/live?action=roster.
// No UI consumer exists. Merge into /api/players or remove.

import { NextRequest, NextResponse } from 'next/server'
import { fetchTeamRoster, fetchLeagueLeaders, ESPN_LEAGUES } from '@/lib/football-data'

import { rateLimit } from '@/lib/rate-limit'
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Rate limiting
    const ip = _req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`player-detail:${ip}`, 20, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { id } = await params

    // Try to find the player across all league rosters
    for (const league of ESPN_LEAGUES) {
      const roster = await fetchTeamRoster(league.code, id)
      // The player endpoint receives a team+player composite; try fetching
      // the roster for this id treated as a team id first.
      // If the id is a player id, we need to search differently.
    }

    // The id could be a player id or a team id used to fetch a roster.
    // Try fetching league leaders to find the player by id across all leagues.
    let foundPlayer: InstanceType<typeof Object> | null = null
    let foundTeam: string | null = null

    for (const league of ESPN_LEAGUES) {
      const leaders = await fetchLeagueLeaders(league.code, 'goals')
      const match = (leaders as Array<{ name: string; team: string; teamLogo: string; value: number; rank: number; category: string }>).find(
        (l) => l.name && l.name.toLowerCase().includes(id.toLowerCase()),
      )
      if (match) {
        foundPlayer = match
        foundTeam = match.team
        break
      }
    }

    // If not found by name search, try treating id as an ESPN team id and fetch roster
    if (!foundPlayer) {
      for (const league of ESPN_LEAGUES) {
        const roster = await fetchTeamRoster(league.code, id)
        if (roster.length > 0) {
          // Return the full roster for this team
          return NextResponse.json({
            id,
            teamId: id,
            league: league.name,
            players: roster,
          })
        }
      }
    }

    if (!foundPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...foundPlayer,
      team: foundTeam,
      source: 'ESPN',
    })
  } catch (error) {
    console.error('Player detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 })
  }
}
