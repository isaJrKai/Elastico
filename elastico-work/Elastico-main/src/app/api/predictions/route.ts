import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/** GET /api/predictions — fetch current user's predictions with match data */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    const { user } = auth
    const predictions = await db.prediction.findMany({
      where: { userId: user.id },
      include: {
        match: {
          include: {
            homeTeam: { select: { name: true, code: true, primaryColor: true } },
            awayTeam: { select: { name: true, code: true, primaryColor: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ predictions })
  } catch (error) {
    console.error('Fetch predictions error:', error)
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const { matchId, predictedHomeGoals, predictedAwayGoals, predictedOutcome, confidence, model } = await req.json()

    if (!matchId || predictedHomeGoals == null || predictedAwayGoals == null || !predictedOutcome || !confidence) {
      return NextResponse.json(
        { error: 'matchId, predictedHomeGoals, predictedAwayGoals, predictedOutcome, and confidence are required' },
        { status: 400 }
      )
    }

    if (!['home', 'draw', 'away'].includes(predictedOutcome)) {
      return NextResponse.json({ error: 'predictedOutcome must be home, draw, or away' }, { status: 400 })
    }

    if (confidence < 0 || confidence > 100) {
      return NextResponse.json({ error: 'confidence must be between 0 and 100' }, { status: 400 })
    }

    const match = await db.match.findUnique({ where: { id: matchId } })
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check if match is already finished
    if (match.status === 'finished') {
      return NextResponse.json({ error: 'Cannot predict a finished match' }, { status: 400 })
    }

    // Check free plan limit
    if (user.plan === 'free') {
      const usedCount = await db.prediction.count({ where: { userId: user.id } })
      if (usedCount >= 3) {
        return NextResponse.json({ error: 'Free plan limited to 3 predictions. Upgrade to Pro for unlimited.' }, { status: 403 })
      }
    }

    // Upsert prediction
    const prediction = await db.prediction.upsert({
      where: { userId_matchId: { userId: user.id, matchId } },
      update: {
        predictedHomeGoals,
        predictedAwayGoals,
        predictedOutcome,
        confidence,
        model: model || 'user',
      },
      create: {
        userId: user.id,
        matchId,
        predictedHomeGoals,
        predictedAwayGoals,
        predictedOutcome,
        confidence,
        model: model || 'user',
      },
    })

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        type: 'prediction',
        metadata: JSON.stringify({ matchId, predictedOutcome, confidence }),
      },
    })

    return NextResponse.json({ prediction }, { status: 201 })
  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}