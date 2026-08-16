import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const teams = await db.team.findMany({
      orderBy: { eloRating: 'desc' },
      include: {
        _count: { select: { players: true } },
      },
    })

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

    return NextResponse.json({ teams: result }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Teams list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}