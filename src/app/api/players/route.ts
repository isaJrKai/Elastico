import { NextRequest, NextResponse } from 'next/server'
import { fetchLeagueLeaders, fetchTeamRoster } from '@/lib/football-data'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams
    const teamId = url.get('teamId')
    const search = url.get('search')
    const limit = Math.min(parseInt(url.get('limit') || '50'), 200)
    const offset = parseInt(url.get('offset') || '0')
    const league = url.get('league') || 'PL'

    // ── ESPN team roster (specific team) ──────────────────────────────────
    if (teamId) {
      const roster = await fetchTeamRoster(league, teamId)
      if (roster.length > 0) {
        const players = roster.map((p, i) => ({
          id: p.id,
          name: p.name,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position || 'Unknown',
          age: p.age,
          nationality: p.nationality,
          shirtNumber: p.shirtNumber,
          rating: undefined,
          goals: p.goals,
          assists: p.assists,
          appearances: p.appearances,
          team: { id: teamId, name: '', code: '', primaryColor: '#00e676' },
          marketValue: 0,
          yellowCards: 0,
          redCards: 0,
        }))
        return NextResponse.json({
          players,
          total: players.length,
          limit,
          offset: 0,
          hasMore: false,
          source: 'espn-roster',
        })
      }
    }

    // ── ESPN league leaders (top scorers) ─────────────────────────────────
    const leaders = await fetchLeagueLeaders(league)
    if (leaders.length > 0) {
      const players = leaders.map((l, i) => ({
        id: `espn-leader-${l.rank}-${i}`,
        name: l.name,
        firstName: '',
        lastName: l.name,
        position: 'Forward',
        age: 0,
        nationality: '',
        shirtNumber: 0,
        rating: undefined,
        goals: l.value,
        assists: 0,
        appearances: 0,
        team: { id: '', name: l.team, code: '', primaryColor: '#00e676', logo: l.teamLogo },
        marketValue: 0,
        yellowCards: 0,
        redCards: 0,
      }))

      // Apply search filter
      const filtered = search
        ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        : players

      const paginated = filtered.slice(offset, offset + limit)

      return NextResponse.json({
        players: paginated,
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length,
        source: 'espn-leaders',
      })
    }

    return NextResponse.json({
      players: [],
      total: 0,
      limit,
      offset,
      hasMore: false,
      source: 'none',
    })
  } catch (error) {
    console.error('Players fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
}
