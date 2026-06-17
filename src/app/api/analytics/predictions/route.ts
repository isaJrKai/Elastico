import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams
    const model = url.get('model') || 'all'
    const startDate = url.get('startDate')

    const where: Record<string, unknown> = { isCorrect: { not: null } }
    if (model !== 'all') where.model = model
    if (startDate) {
      where.createdAt = { gte: new Date(startDate) }
    }

    const predictions = await db.prediction.findMany({
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
      where: { isCorrect: { not: null } },
      _count: { id: true, isCorrect: true },
      _sum: { isCorrect: true },
    })

    const accuracy = modelStats.map((m) => ({
      model: m.model,
      total: m._count.id,
      correct: m._sum.isCorrect || 0,
      accuracy: m._count.id > 0 ? ((m._sum.isCorrect || 0) / m._count.id) * 100 : 0,
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