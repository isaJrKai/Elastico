import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const team = await db.team.findUnique({
      where: { id },
      include: {
        players: { orderBy: [{ position: 'asc' }, { number: 'asc' }] },
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Get recent match results (last 10)
    const recentHome = await db.match.findMany({
      where: { homeTeamId: id, status: 'finished' },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        homeTeam: { select: { id: true, name: true, code: true, logo: true } },
        awayTeam: { select: { id: true, name: true, code: true, logo: true } },
      },
    })

    const recentAway = await db.match.findMany({
      where: { awayTeamId: id, status: 'finished' },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        homeTeam: { select: { id: true, name: true, code: true, logo: true } },
        awayTeam: { select: { id: true, name: true, code: true, logo: true } },
      },
    })

    // Merge and sort recent matches
    const allRecent = [...recentHome, ...recentAway]
      .sort((a, b) => {
        const dateA = a.date?.getTime() || 0
        const dateB = b.date?.getTime() || 0
        return dateB - dateA
      })
      .slice(0, 10)

    return NextResponse.json({
      team: { ...team, recentMatches: allRecent },
    })
  } catch (error) {
    console.error('Team detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}