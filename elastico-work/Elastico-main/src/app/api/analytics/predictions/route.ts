import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams
    const model = url.get('model') || 'all'
    const startDate = url.get('startDate')

    const where: Record<string, unknown> = {}
    if (model !== 'all') where.model = model
    if (startDate) {
      where.createdAt = { gte: new Date(startDate) }
    }

    const predictions = await (db as any).prediction.findMany({
      where,
      include: {
        match: {
          include: {
            homeTeam: { select: { name: true, code: true } },
            awayTeam: { select: { name: true, code: true } },
          },
        },
        user: { select: { id: true, name: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Aggregate accuracy by model
    const modelStats = await db.prediction.groupBy({
      by: ['model'],
      _count: { id: true },
    })

    // Count correct predictions per model
    const accuracyData: Record<string, { total: number; correct: number }> = {}
    for (const stat of modelStats) {
      const modelKey = stat.model || 'unknown'
      accuracyData[modelKey] = { total: stat._count.id, correct: 0 }
    }

    // Count correct predictions from fetched predictions (where isCorrect is true)
    for (const p of predictions) {
      if (p.isCorrect === true && p.model) {
        if (!accuracyData[p.model]) {
          accuracyData[p.model] = { total: 0, correct: 0 }
        }
        accuracyData[p.model].correct++
      }
    }

    const accuracy = Object.entries(accuracyData).map(([modelKey, data]) => ({
      model: modelKey,
      total: data.total,
      correct: data.correct,
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    }))

    // Overall accuracy
    const totalPreds = predictions.length
    const correctPreds = predictions.filter((p) => p.isCorrect === true).length

    return NextResponse.json({
      predictions,
      accuracy,
      overall: {
        total: totalPreds,
        correct: correctPreds,
        accuracy: totalPreds > 0 ? (correctPreds / totalPreds) * 100 : 0,
      },
    })
  } catch (error) {
    console.error('Prediction analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch prediction analytics' }, { status: 500 })
  }
}