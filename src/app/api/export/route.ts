import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const { type, format, filters } = await req.json()
    const exportFormat = format || 'csv'
    const exportType = type || 'predictions'

    let data: unknown[] = []
    let filename = `elastico-${exportType}-${Date.now()}`

    switch (exportType) {
      case 'matches': {
        // Match data now comes from ESPN — return empty export with a note
        data = []
        filename = `elastico-matches-empty-${Date.now()}`
        break
      }
      case 'players': {
        // Player data now comes from ESPN — return empty export with a note
        data = []
        filename = `elastico-players-empty-${Date.now()}`
        break
      }
      case 'predictions': {
        const preds = await db.prediction.findMany({
          where: { userId: user.id },
          take: 500,
          orderBy: { createdAt: 'desc' },
        })
        data = preds.map((p) => ({
          date: p.createdAt.toISOString().split('T')[0],
          match_id: p.matchId,
          predicted_home: p.predictedHomeGoals,
          predicted_away: p.predictedAwayGoals,
          outcome: p.predictedOutcome,
          correct: p.isCorrect,
          model: p.model,
          confidence: p.confidence,
          points: p.points,
        }))
        break
      }
      case 'teams': {
        // Team data now comes from ESPN — return empty export with a note
        data = []
        filename = `elastico-teams-empty-${Date.now()}`
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
    }

    if (exportFormat === 'csv') {
      if (data.length === 0) {
        return NextResponse.json({
          error: 'No data to export. Match, player, and team data now come from ESPN and are not stored locally.',
          suggestion: 'Use predictions export for your prediction history.',
        }, { status: 404 })
      }
      const headers = Object.keys(data[0] as Record<string, unknown>)
      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          headers.map((h) => {
            const val = String((row as Record<string, unknown>)[h] ?? '')
            return val.includes(',') ? `"${val}"` : val
          }).join(','),
        ),
      ]
      const csv = csvRows.join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      data,
      meta: { type: exportType, format: 'json', rows: data.length, exportedAt: new Date().toISOString() },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 })
  }
}
