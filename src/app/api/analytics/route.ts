import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'overview'

    if (type === 'elo_distribution') {
      const teams = await db.team.findMany({
        select: { id: true, name: true, code: true, eloRating: true, group: true },
        orderBy: { eloRating: 'desc' },
      })

      const avgElo = teams.length > 0
        ? Math.round(teams.reduce((sum, t) => sum + t.eloRating, 0) / teams.length)
        : 0

      return NextResponse.json({
        eloDistribution: teams,
        stats: {
          average: avgElo,
          highest: teams[0]?.eloRating || 0,
          lowest: teams[teams.length - 1]?.eloRating || 0,
          total: teams.length,
        },
      })
    }

    if (type === 'prediction_accuracy') {
      // Recent prediction accuracy by model
      const predictions = await db.prediction.findMany({
        where: { isCorrect: { not: null } },
        select: { model: true, isCorrect: true },
      })

      const byModel: Record<string, { total: number; correct: number; accuracy: number }> = {}
      for (const p of predictions) {
        if (!byModel[p.model]) byModel[p.model] = { total: 0, correct: 0, accuracy: 0 }
        byModel[p.model].total++
        if (p.isCorrect) byModel[p.model].correct++
      }

      for (const key of Object.keys(byModel)) {
        byModel[key].accuracy = Math.round((byModel[key].correct / byModel[key].total) * 1000) / 100
      }

      return NextResponse.json({ byModel })
    }

    if (type === 'user_growth') {
      const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentUsers = await db.user.count({ where: { createdAt: { gte: last30 } } })
      const totalUsers = await db.user.count()

      const userByPlan = await db.user.groupBy({
        by: ['plan'],
        _count: true,
      })

      return NextResponse.json({
        totalUsers,
        recentUsers,
        byPlan: userByPlan.map((g) => ({ plan: g.plan, count: g._count })),
      })
    }

    if (type === 'match_outcomes') {
      const finished = await db.match.count({ where: { status: 'finished' } })
      const live = await db.match.count({ where: { status: 'live' } })
      const upcoming = await db.match.count({ where: { status: 'upcoming' } })
      const postponed = await db.match.count({ where: { status: 'postponed' } })

      const byStage = await db.match.groupBy({
        by: ['stage'],
        _count: true,
      })

      return NextResponse.json({
        byStatus: { finished, live, upcoming, postponed },
        byStage: byStage.map((s) => ({ stage: s.stage, count: s._count })),
        total: finished + live + upcoming + postponed,
      })
    }

    // Overview
    const [totalUsers, totalMatches, totalPredictions, totalVotes, activeTeams] = await Promise.all([
      db.user.count(),
      db.match.count(),
      db.prediction.count(),
      db.vote.count(),
      db.team.count(),
    ])

    const avgAccuracy = await db.user.aggregate({
      _avg: { predictionAccuracy: true },
      where: { totalPredictions: { gte: 1 } },
    })

    return NextResponse.json({
      overview: {
        totalUsers,
        totalMatches,
        totalPredictions,
        totalVotes,
        activeTeams,
        averagePredictionAccuracy: avgAccuracy._avg.predictionAccuracy || 0,
      },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}