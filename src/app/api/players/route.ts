import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchLeagueLeaders, fetchTeamRoster, fetchTeams, ESPN_LEAGUES } from '@/lib/football-data'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams
    const teamId = url.get('teamId')
    const position = url.get('position')
    const search = url.get('search')
    const sortBy = url.get('sortBy') || 'rating'
    const limit = Math.min(parseInt(url.get('limit') || '50'), 200)
    const offset = parseInt(url.get('offset') || '0')
    const league = url.get('league') || 'PL'

    // ── Try DB first ──────────────────────────────────────────────────────
    try {
      const where: Record<string, unknown> = {}
      if (teamId) where.teamId = teamId
      if (position) where.position = position
      if (search) where.name = { contains: search, mode: 'insensitive' }

      const orderBy: Record<string, string> = {}
      if (sortBy === 'name') orderBy.name = 'asc'
      else if (sortBy === 'goals') orderBy.goals = 'desc'
      else if (sortBy === 'assists') orderBy.assists = 'desc'
      else if (sortBy === 'age') orderBy.age = 'asc'
      else if (sortBy === 'marketValue') orderBy.marketValue = 'desc'
      else orderBy.rating = 'desc'

      const [players, total] = await Promise.all([
        db.player.findMany({
          where,
          orderBy,
          take: limit,
          skip: offset,
          include: { team: { select: { id: true, name: true, code: true, primaryColor: true } } },
        }),
        db.player.count({ where }),
      ])

      if (players.length > 0) {
        return NextResponse.json({
          players,
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
          source: 'database',
        })
      }
    } catch (dbErr) {
      console.warn('[Players] DB unavailable, falling back to ESPN:', dbErr)
    }

    // ── Fallback: ESPN league leaders (top scorers) ───────────────────────
    if (teamId) {
      // Try roster for specific team
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

    // Get top scorers from ESPN
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
