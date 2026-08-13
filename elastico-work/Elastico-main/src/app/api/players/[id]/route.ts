import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const player = await db.player.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            code: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Get match history for this player via match events
    const events = await db.matchEvent.findMany({
      where: { playerId: id },
      include: {
        match: {
          include: {
            homeTeam: { select: { id: true, name: true, code: true } },
            awayTeam: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { match: { date: 'desc' } },
      take: 20,
    })

    return NextResponse.json({
      ...player,
      matchHistory: events.map((e) => ({
        matchId: e.match.id,
        minute: e.minute,
        type: e.type,
        team: e.team,
        match: `${e.match.homeTeam.code} vs ${e.match.awayTeam.code}`,
        date: e.match.date,
      })),
    })
  } catch (error) {
    console.error('Player detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 })
  }
}