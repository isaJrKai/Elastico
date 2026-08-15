import { NextRequest, NextResponse } from 'next/server'
import { fetchTeams, fetchStandings } from '@/lib/football-data'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const leagueCode = searchParams.get('league') || 'PL'

    // ── Fetch from ESPN: standings (team stats) + team list (logos) ───────
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
