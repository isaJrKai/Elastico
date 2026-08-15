import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'predictors'

    if (type !== 'predictors') {
      return NextResponse.json({ error: 'Invalid leaderboard type. Only "predictors" is supported.' }, { status: 400 })
    }

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
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}