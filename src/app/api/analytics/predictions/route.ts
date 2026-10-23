import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    const limit = rateLimit(`analytics-predictions:${auth.user.id}`, 30, 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: limit.retryAfterMs }, { status: 429 })
    }

    const url = req.nextUrl.searchParams
    const model = url.get('model') || 'all'
    const startDate = url.get('startDate')

    if (model.length > 50) return NextResponse.json({ error: 'Invalid model filter' }, { status: 400 })
    const where: Prisma.PredictionWhereInput = {}
    if (model !== 'all') where.model = model
    if (startDate) {
      const parsedStartDate = new Date(startDate)
      if (Number.isNaN(parsedStartDate.getTime())) {
        return NextResponse.json({ error: 'startDate must be a valid date' }, { status: 400 })
      }
      where.createdAt = { gte: parsedStartDate }
    }

    const predictions = await db.prediction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Aggregate from the full filtered dataset; do not mix a 100-row sample with global totals.
    const [modelStats, correctStats, totalPreds, correctPreds] = await Promise.all([
      db.prediction.groupBy({
        by: ['model'],
        where,
        _count: { id: true },
      }),
      db.prediction.groupBy({
        by: ['model'],
        where: { ...where, isCorrect: true },
        _count: { id: true },
      }),
      db.prediction.count({ where }),
      db.prediction.count({ where: { ...where, isCorrect: true } }),
    ])

    const correctByModel = new Map(correctStats.map((stat) => [stat.model || 'unknown', stat._count.id]))
    const accuracy = modelStats.map((stat) => {
      const modelKey = stat.model || 'unknown'
      const total = stat._count.id
      const correct = correctByModel.get(modelKey) || 0
      return {
        model: modelKey,
        total,
        correct,
        accuracy: total > 0 ? (correct / total) * 100 : null,
      }
    })

    return NextResponse.json({
      predictions,
      accuracy,
      overall: {
        total: totalPreds,
        correct: correctPreds,
        accuracy: totalPreds > 0 ? (correctPreds / totalPreds) * 100 : null,
      },
    })
  } catch (error) {
    console.error('Prediction analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch prediction analytics' }, { status: 500 })
  }
}