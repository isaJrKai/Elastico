import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchTeams, fetchStandings, ESPN_LEAGUES } from '@/lib/football-data'

export async function GET(req: NextRequest) {
  try {
    // ── Try DB first ──────────────────────────────────────────────────────
    try {
      const teams = await db.team.findMany({
        orderBy: { eloRating: 'desc' },
        include: {
          _count: { select: { players: true } },
        },
      })

      if (teams.length > 0) {
        const result = teams.map((team) => ({
          id: team.id,
          name: team.name,
          code: team.code,
          logo: team.logo,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
          eloRating: team.eloRating,
          wins: team.wins,
          draws: team.draws,
          losses: team.losses,
          goalsFor: team.goalsFor,
          goalsAgainst: team.goalsAgainst,
          group: team.group,
          rank: team.rank,
          coachName: team.coachName,
          style: team.style,
          xgPerGame: team.xgPerGame,
          xgaPerGame: team.xgaPerGame,
          possession: team.possession,
          passAccuracy: team.passAccuracy,
          pressIntensity: team.pressIntensity,
          playerCount: team._count.players,
        }))

        return NextResponse.json({ teams: result, source: 'database' })
      }
    } catch (dbErr) {
      console.warn('[Teams] DB unavailable, falling back to ESPN:', dbErr)
    }

    // ── Fallback: ESPN standings (gives us teams with stats) ────────────────
    const { searchParams } = new URL(req.url)
    const leagueCode = searchParams.get('league') || 'PL'

    // Fetch standings which has team stats, plus team list for logos
    const [standingsData, teamsData] = await Promise.all([
      fetchStandings(leagueCode),
      fetchTeams(leagueCode),
    ])

    // Build a logo lookup from teams data
    const logoMap = new Map<string, string>()
    for (const t of teamsData) {
      logoMap.set(t.name, t.logo)
      logoMap.set(t.abbreviation, t.logo)
    }

    if (standingsData.length > 0) {
      const result = standingsData.map((s, i) => ({
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
        rank: s.rank,
        playerCount: 0,
      }))

      return NextResponse.json({ teams: result, source: 'espn' })
    }

    // If standings empty, try teams endpoint alone
    if (teamsData.length > 0) {
      const result = teamsData.map(t => ({
        id: `espn-team-${t.id}`,
        name: t.name,
        code: t.abbreviation,
        logo: t.logo,
        primaryColor: t.color || '#00e676',
        secondaryColor: '#004d40',
        eloRating: 1500,
        playerCount: 0,
      }))

      return NextResponse.json({ teams: result, source: 'espn' })
    }

    return NextResponse.json({ teams: [], source: 'none' })
  } catch (error) {
    console.error('Teams list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
