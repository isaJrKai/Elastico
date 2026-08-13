import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'predictors'

    if (type === 'predictors') {
      // Predictors leaderboard - users sorted by accuracy, min 5 predictions
      const leaders = await db.user.findMany({
        where: {
          totalPredictions: { gte: 5 },
          isActive: true,
          role: { not: 'admin' },
        },
        orderBy: [
          { predictionAccuracy: 'desc' },
          { bestStreak: 'desc' },
          { totalPredictions: 'desc' },
        ],
        take: 50,
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          plan: true,
          predictionAccuracy: true,
          predictionStreak: true,
          bestStreak: true,
          totalPredictions: true,
          correctPredictions: true,
        },
      })

      return NextResponse.json({
        leaderboard: leaders.map((u, idx) => ({ rank: idx + 1, ...u })),
      })
    }

    if (type === 'golden_boot') {
      // Golden boot - top scorers from players
      const scorers = await db.player.findMany({
        where: { goals: { gt: 0 } },
        orderBy: [{ goals: 'desc' }, { assists: 'desc' }],
        take: 30,
        include: {
          team: { select: { id: true, name: true, code: true, logo: true, primaryColor: true } },
        },
      })

      return NextResponse.json({
        leaderboard: scorers.map((p, idx) => ({
          rank: idx + 1,
          id: p.id,
          name: p.name,
          number: p.number,
          position: p.position,
          goals: p.goals,
          assists: p.assists,
          team: p.team,
        })),
      })
    }

    return NextResponse.json({ error: 'Invalid leaderboard type. Use "predictors" or "golden_boot"' }, { status: 400 })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}