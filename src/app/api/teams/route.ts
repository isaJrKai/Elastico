import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchTeams, fetchStandings } from '@/lib/football-data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const league = searchParams.get('league') || undefined
    const search = searchParams.get('search') || undefined

    // ── Try database first ────────────────────────────────────────────────
    const where: any = {}
    if (league) where.leagueCode = league
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const dbTeams = await db.team.findMany({
      where,
      include: {
        _count: { select: { players: true },
        analytics: {
          where: { source: 'understat' },
          orderBy: { syncedAt: 'desc' },
          take: 1,
        },
      },
      },
      orderBy: { name: 'asc' },
    })

    if (dbTeams.length > 0) {
      const teams = dbTeams.map(t => ({
        id: t.id,
        externalId: t.externalId,
        name: t.name,
        code: t.code,
        logo: t.logo,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        country: t.country,
        league: t.league,
        leagueCode: t.leagueCode,
        eloRating: t.eloRating,
        wins: t.wins,
        draws: t.draws,
        losses: t.losses,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        playerCount: t._count.players,
        source: t.source,
        lastSyncedAt: t.lastSyncedAt?.toISOString() || null,
      }))

      return NextResponse.json({ teams, source: 'database', total: teams.length })
    }

    // ── Fallback: ESPN direct fetch ───────────────────────────────────────
    console.log('[Teams] DB empty, falling back to ESPN')
    const leagueCode = league || 'PL'

    const [standingsData, teamsData] = await Promise.all([
      fetchStandings(leagueCode),
      fetchTeams(leagueCode),
    ])

    const logoMap = new Map<string, string>()
    for (const t of teamsData) {
      logoMap.set(t.name, t.logo)
      logoMap.set(t.abbreviation, t.logo)
    }

    if (standingsData.length > 0) {
      const teams = standingsData.map((s, i) => ({
        id: `espn-team-${s.code}-${i}`,
        name: s.team,
        code: s.code,
        logo: s.logo || logoMap.get(s.team) || logoMap.get(s.code) || '',
        primaryColor: '#00e676',
        secondaryColor: '#004d40',
        eloRating: 1500 + (s.points * 3) - (s.rank * 10),
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        playerCount: 0,
      }))

      return NextResponse.json({ teams, source: 'espn', total: teams.length })
    }

    if (teamsData.length > 0) {
      const teams = teamsData.map(t => ({
        id: `espn-team-${t.id}`,
        name: t.name,
        code: t.abbreviation,
        logo: t.logo,
        primaryColor: t.color || '#00e676',
        secondaryColor: '#004d40',
        eloRating: 1500,
        playerCount: 0,
      }))

      return NextResponse.json({ teams, source: 'espn', total: teams.length })
    }

    return NextResponse.json({ teams: [], source: 'none', total: 0 })
  } catch (error) {
    console.error('Teams list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
