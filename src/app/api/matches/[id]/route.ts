import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores } from '@/lib/football-data'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch all live scores from ESPN and find by ID
    const allMatches = await fetchAllLiveScores()
    const match = allMatches.find((m) => m.id === id)

    if (!match) {
      return NextResponse.json({ error: 'Match not found in ESPN live data' }, { status: 404 })
    }

    return NextResponse.json({ match })
  } catch (error) {
    console.error('Match detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const { id } = await params
    const { choice } = await req.json()

    if (!choice || !['home', 'draw', 'away'].includes(choice)) {
      return NextResponse.json({ error: 'Choice must be home, draw, or away' }, { status: 400 })
    }

    // Fetch ESPN match to get denormalized team names for the Vote record
    const allMatches = await fetchAllLiveScores()
    const espnMatch = allMatches.find((m) => m.id === id)
    if (!espnMatch) {
      return NextResponse.json({ error: 'Match not found in ESPN data' }, { status: 404 })
    }

    // Upsert vote using the ESPN match id
    const vote = await db.vote.upsert({
      where: { userId_matchId: { userId: user.id, matchId: id } },
      update: { choice },
      create: { userId: user.id, matchId: id, choice, homeTeam: espnMatch.homeTeam.name, awayTeam: espnMatch.awayTeam.name },
    })

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        type: 'vote',
        metadata: JSON.stringify({ matchId: id, choice }),
      },
    })

    return NextResponse.json({ vote })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
