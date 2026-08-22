import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchLeagueLeaders, fetchTeamRoster } from '@/lib/football-data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams
    const teamId = url.get('teamId')
    const search = url.get('search')
    const position = url.get('position')
    const limit = Math.min(parseInt(url.get('limit') || '50'), 200)
    const offset = parseInt(url.get('offset') || '0')

    // ── Try database first ──────────────────────────────────────────────
    const where: any = {}
    if (teamId) where.teamId = teamId
    if (position) where.position = position
    if (search) where.name = { contains: search.toLowerCase() }

    const [dbPlayers, total] = await Promise.all([
      db.player.findMany({
        where,
        include: { team: true },
        orderBy: { goals: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.player.count({ where }),
    ])

    if (dbPlayers.length > 0) {
      const players = dbPlayers.map(p => ({
        id: p.id,
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        age: p.age,
        nationality: p.nationality,
        photo: p.photo,
        number: p.number,
        goals: p.goals,
        assists: p.assists,
        appearances: p.appearances,
        minutesPlayed: p.minutesPlayed,
        rating: p.rating,
        yellowCards: p.yellowCards,
        redCards: p.redCards,
        team: {
          id: p.team.id,
          name: p.team.name,
          code: p.team.code,
          logo: p.team.logo,
          primaryColor: p.team.primaryColor,
        },
        source: p.source,
      }))

      return NextResponse.json({
        players,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        source: 'database',
      })
    }

    // ── Fallback: ESPN direct fetch ───────────────────────────────────────
    console.log('[Players] DB empty, falling back to ESPN')
    const league = url.get('league') || 'PL'

    // Team roster (specific team)
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

    // League leaders (top scorers)
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
        yellowCards: 0,
        redCards: 0,
      }))

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
