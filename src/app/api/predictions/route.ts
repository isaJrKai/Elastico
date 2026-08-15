import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const {
      matchId,
      predictedHomeGoals,
      predictedAwayGoals,
      predictedOutcome,
      confidence,
      model,
      homeTeam,
      awayTeam,
      competition,
      matchDate,
    } = await req.json()

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

    // Check free plan limit
    if (user.plan === 'free') {
      const usedCount = await db.prediction.count({ where: { userId: user.id } })
      if (usedCount >= 3) {
        return NextResponse.json({ error: 'Free plan limited to 3 predictions. Upgrade to Pro for unlimited.' }, { status: 403 })
      }
    }

    // Upsert prediction (uses denormalized fields)
    const prediction = await db.prediction.upsert({
      where: { userId_matchId: { userId: user.id, matchId } },
      update: {
        predictedHomeGoals,
        predictedAwayGoals,
        predictedOutcome,
        confidence,
        model: model || 'user',
        homeTeam: homeTeam || undefined,
        awayTeam: awayTeam || undefined,
        competition: competition || undefined,
        matchDate: matchDate || undefined,
      },
      create: {
        userId: user.id,
        matchId,
        predictedHomeGoals,
        predictedAwayGoals,
        predictedOutcome,
        confidence,
        model: model || 'user',
        homeTeam: homeTeam || undefined,
        awayTeam: awayTeam || undefined,
        competition: competition || undefined,
        matchDate: matchDate || undefined,
      },
    })

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        type: 'prediction',
        metadata: JSON.stringify({ matchId, predictedOutcome, confidence, homeTeam, awayTeam, competition }),
      },
    })

    return NextResponse.json({ prediction }, { status: 201 })
  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}