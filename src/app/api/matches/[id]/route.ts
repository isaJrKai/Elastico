import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const match = await db.match.findUnique({
      where: { id },
      include: {
        homeTeam: {
          include: {
            players: { orderBy: { position: 'asc' } },
          },
        },
        awayTeam: {
          include: {
            players: { orderBy: { position: 'asc' } },
          },
        },
        events: { orderBy: { minute: 'asc' } },
        votes: {
          include: {
            user: { select: { id: true, name: true, displayName: true, avatarUrl: true, plan: true } },
          },
        },
        predictions: {
          include: {
            user: { select: { id: true, name: true, displayName: true, avatarUrl: true, predictionAccuracy: true } },
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { predictions: true, votes: true, bookmarks: true } },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Compute vote distribution
    const voteCounts = { home: 0, draw: 0, away: 0 }
    for (const vote of match.votes) {
      if (vote.choice in voteCounts) {
        voteCounts[vote.choice as keyof typeof voteCounts]++
      }
    }

    return NextResponse.json({
      match: { ...match, voteDistribution: voteCounts },
    })
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

    const match = await db.match.findUnique({ where: { id } })
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Upsert vote
    const vote = await db.vote.upsert({
      where: { userId_matchId: { userId: user.id, matchId: id } },
      update: { choice },
      create: { userId: user.id, matchId: id, choice },
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