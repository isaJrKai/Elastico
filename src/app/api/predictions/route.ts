import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { z } from 'zod'

const CreatePredictionSchema = z.object({
  matchId: z.string().trim().min(1).max(128),
  predictedHomeGoals: z.number().int().min(0).max(20),
  predictedAwayGoals: z.number().int().min(0).max(20),
  predictedOutcome: z.enum(['home', 'draw', 'away']),
  confidence: z.number().finite().min(0).max(100),
  homeTeam: z.string().trim().max(100).nullable().optional(),
  awayTeam: z.string().trim().max(100).nullable().optional(),
  competition: z.string().trim().max(100).nullable().optional(),
  matchDate: z.string().datetime().nullable().optional(),
})

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

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreatePredictionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid prediction payload' }, { status: 400 })
    }

    const {
      matchId,
      predictedHomeGoals,
      predictedAwayGoals,
      predictedOutcome,
      confidence,
      homeTeam,
      awayTeam,
      competition,
      matchDate,
    } = parsed.data

    const scoreOutcome = predictedHomeGoals > predictedAwayGoals
      ? 'home'
      : predictedHomeGoals < predictedAwayGoals
        ? 'away'
        : 'draw'
    if (predictedOutcome !== scoreOutcome) {
      return NextResponse.json(
        { error: 'Predicted outcome must match the submitted scoreline' },
        { status: 400 },
      )
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
        model: 'user',
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
        model: 'user',
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