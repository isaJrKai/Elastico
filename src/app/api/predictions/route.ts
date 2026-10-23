import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
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

    const matchIdCandidates = [...new Set([
      matchId,
      matchId.includes(':') ? matchId.slice(matchId.indexOf(':') + 1) : matchId,
    ])]
    const storedMatch = await db.match.findFirst({
      where: {
        OR: [
          { id: { in: matchIdCandidates } },
          { externalId: { in: matchIdCandidates } },
          { sourceId: { in: matchIdCandidates } },
        ],
      },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    })
    if (!storedMatch) {
      return NextResponse.json({ error: 'Match is not in the verified database; prediction was not saved' }, { status: 404 })
    }
    const kickoff = storedMatch.date
    const normalizedStatus = storedMatch.status.toLowerCase().replace(/[\\s-]+/g, '_')
    const closedStatuses = new Set([
      'finished', 'ft', 'complete', 'completed', 'final', 'ended',
      'live', 'in_play', 'in_progress', 'halftime', 'ht', '1h', '2h',
      'postponed', 'cancelled', 'canceled', 'abandoned', 'suspended',
    ])
    if (!kickoff || kickoff <= new Date() || closedStatuses.has(normalizedStatus)) {
      return NextResponse.json({ error: 'Predictions are only accepted for verified future fixtures' }, { status: 400 })
    }
    const canonicalMatchId = storedMatch.id
    const canonicalHomeTeam = storedMatch.homeTeam.name
    const canonicalAwayTeam = storedMatch.awayTeam.name
    const canonicalCompetition = storedMatch.competition

    const candidatePredictionIds = [...new Set([
      canonicalMatchId,
      matchId,
      storedMatch.externalId,
      storedMatch.sourceId,
      ...matchIdCandidates,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0))]

    const result = await db.$transaction(async (tx) => {
      const existingPrediction = await tx.prediction.findFirst({
        where: { userId: user.id, matchId: { in: candidatePredictionIds } },
        select: { id: true },
      })

      // Check quota only for a new prediction; edits to an existing prediction do not consume a slot.
      if (user.plan === 'free' && !existingPrediction) {
        const usedCount = await tx.prediction.count({ where: { userId: user.id } })
        if (usedCount >= 3) return { blocked: true as const }
      }

      const predictionData = {
        matchId: canonicalMatchId,
        predictedHomeGoals,
        predictedAwayGoals,
        predictedOutcome,
        confidence,
        model: 'user',
        homeTeam: canonicalHomeTeam,
        awayTeam: canonicalAwayTeam,
        competition: canonicalCompetition,
        matchDate: kickoff,
      }

      const prediction = existingPrediction
        ? await tx.prediction.update({ where: { id: existingPrediction.id }, data: predictionData })
        : await tx.prediction.create({ data: { userId: user.id, ...predictionData } })

      return { blocked: false as const, prediction, isUpdate: Boolean(existingPrediction) }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (result.blocked) {
      return NextResponse.json(
        { error: 'Free plan limited to 3 predictions. Upgrade to Pro for unlimited.' },
        { status: 403 },
      )
    }
    const prediction = result.prediction

    // Activity logs are best-effort; a logging outage must not report a saved prediction as failed.
    try {
      await db.activity.create({
        data: {
          userId: user.id,
          type: 'prediction',
          metadata: JSON.stringify({
            matchId: canonicalMatchId,
            predictedOutcome,
            confidence,
            homeTeam: canonicalHomeTeam,
            awayTeam: canonicalAwayTeam,
            competition: canonicalCompetition,
          }),
        },
      })
    } catch {
      console.error('[Predictions] Activity log write failed')
    }

    return NextResponse.json({ prediction }, { status: result.isUpdate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
      return NextResponse.json({ error: 'Concurrent prediction update; retry the request' }, { status: 409 })
    }
    console.error('Prediction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}