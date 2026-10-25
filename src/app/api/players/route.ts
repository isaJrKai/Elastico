import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchTeamRoster } from '@/lib/football-data'

import { rateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`players:${ip}`, 30, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const url = req.nextUrl.searchParams
    const teamId = url.get('teamId')
    const search = url.get('search')
    const position = url.get('position')
    const league = url.get('league') || 'PL'
    const rawLimit = Number.parseInt(url.get('limit') || '50', 10)
    const rawOffset = Number.parseInt(url.get('offset') || '0', 10)
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || !Number.isFinite(rawOffset) || rawOffset < 0) {
      return NextResponse.json({ error: 'limit must be a positive integer and offset must be a non-negative integer' }, { status: 400 })
    }
    const limit = Math.min(rawLimit, 200)
    const offset = rawOffset

    // ── Try database first ──────────────────────────────────────────────
    const where: any = {}
    if (teamId) where.teamId = teamId
    else where.team = { leagueCode: league }
    if (position) where.position = position
    if (search) where.name = { contains: search, mode: 'insensitive' }

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
          // Roster endpoint does not provide disciplinary totals; unknown is not zero.
          yellowCards: null,
          redCards: null,
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

    // League leaders are not a full player dataset. Do not disguise them as
    // complete player records with invented positions, ages, appearances, or cards.
    // The player UI can use the roster endpoint to load actual team rosters instead.
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
