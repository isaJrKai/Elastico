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
    const exportType = type || 'matches'

    let data: unknown[] = []
    let filename = `elastico-${exportType}-${Date.now()}`

    switch (exportType) {
      case 'matches': {
        const matches = await db.match.findMany({
          include: {
            homeTeam: { select: { name: true, code: true } },
            awayTeam: { select: { name: true, code: true } },
          },
          take: 500,
          orderBy: { date: 'desc' },
        })
        data = matches.map((m) => ({
          date: m.date?.toISOString().split('T')[0],
          competition: m.competition,
          stage: m.stage,
          home_team: m.homeTeam.name,
          away_team: m.awayTeam.name,
          home_score: m.homeScore,
          away_score: m.awayScore,
          home_xg: m.homeXg,
          away_xg: m.awayXg,
          possession_home: m.possessionHome,
          shots_home: m.shotsHome,
          shots_away: m.shotsAway,
          status: m.status,
        }))
        break
      }
      case 'players': {
        const players = await db.player.findMany({
          include: { team: { select: { name: true, code: true } } },
          take: 500,
          orderBy: { rating: 'desc' },
        })
        data = players.map((p) => ({
          name: p.name,
          number: p.number,
          position: p.position,
          team: p.team.name,
          goals: p.goals,
          assists: p.assists,
          yellow_cards: p.yellowCards,
          red_cards: p.redCards,
          appearances: p.appearances,
          rating: p.rating,
          market_value: p.marketValue,
          age: p.age,
          nationality: p.nationality,
        }))
        break
      }
      case 'predictions': {
        const preds = await db.prediction.findMany({
          where: { userId: user.id },
          include: {
            match: {
              include: {
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
              },
            },
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        })
        data = preds.map((p) => ({
          date: p.createdAt.toISOString().split('T')[0],
          match: `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`,
          predicted_home: p.predictedHomeGoals,
          predicted_away: p.predictedAwayGoals,
          outcome: p.predictedOutcome,
          actual_home: p.match.homeScore,
          actual_away: p.match.awayScore,
          correct: p.isCorrect,
          model: p.model,
          confidence: p.confidence,
        }))
        break
      }
      case 'teams': {
        const teams = await db.team.findMany({
          include: { players: { select: { id: true } } },
          orderBy: { eloRating: 'desc' },
        })
        data = teams.map((t) => ({
          name: t.name,
          code: t.code,
          elo: t.eloRating,
          wins: t.wins,
          draws: t.draws,
          losses: t.losses,
          goals_for: t.goalsFor,
          goals_against: t.goalsAgainst,
          xg_per_game: t.xgPerGame,
          possession: t.possession,
          pass_accuracy: t.passAccuracy,
          press_intensity: t.pressIntensity,
          player_count: t.players.length,
          style: t.style,
        }))
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
    }

    if (exportFormat === 'csv') {
      if (data.length === 0) {
        return NextResponse.json({ error: 'No data to export' }, { status: 404 })
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