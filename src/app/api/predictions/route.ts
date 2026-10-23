import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/** GET /api/predictions — return authenticated user's predictions (newest first) */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const predictions = await db.prediction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
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

    if (
      typeof matchId !== 'string' || !matchId.trim() ||
      predictedHomeGoals == null || predictedAwayGoals == null ||
      typeof predictedOutcome !== 'string' || confidence == null
    ) {
      return NextResponse.json(
        { error: 'matchId, predictedHomeGoals, predictedAwayGoals, predictedOutcome, and confidence are required' },
        { status: 400 }
      )
    }

    if (
      typeof predictedHomeGoals !== 'number' || !Number.isFinite(predictedHomeGoals) ||
      !Number.isInteger(predictedHomeGoals) || predictedHomeGoals < 0 || predictedHomeGoals > 20 ||
      typeof predictedAwayGoals !== 'number' || !Number.isFinite(predictedAwayGoals) ||
      !Number.isInteger(predictedAwayGoals) || predictedAwayGoals < 0 || predictedAwayGoals > 20
    ) {
      return NextResponse.json({ error: 'Predicted goals must be integers between 0 and 20' }, { status: 400 })
    }

    if (!['home', 'draw', 'away'].includes(predictedOutcome)) {
      return NextResponse.json({ error: 'predictedOutcome must be home, draw, or away' }, { status: 400 })
    }

    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
      return NextResponse.json({ error: 'confidence must be a finite number between 0 and 100' }, { status: 400 })
    }

    for (const [field, value] of Object.entries({ model, homeTeam, awayTeam, competition })) {
      if (value != null && (typeof value !== 'string' || value.length > 200)) {
        return NextResponse.json({ error: `${field} must be a string of at most 200 characters` }, { status: 400 })
      }
    }

    if (matchDate != null && (typeof matchDate !== 'string' || Number.isNaN(Date.parse(matchDate)))) {
      return NextResponse.json({ error: 'matchDate must be a valid date string' }, { status: 400 })
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
      where: { userId_matchId: { userId: user.id, matchId: matchId.trim() } },
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
        matchId: matchId.trim(),
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
        metadata: JSON.stringify({ matchId: matchId.trim(), predictedOutcome, confidence, homeTeam, awayTeam, competition }),
      },
    })

    return NextResponse.json({ prediction }, { status: 201 })
  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}