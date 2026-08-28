import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { fetchAllLiveScores } from '@/lib/football-data'
import { fetchStandings as fetchFDStandings } from '@/lib/football-data-org'

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
        // Fetch from DB first, fall back to ESPN
        const dbMatches = await db.match.findMany({
          include: { homeTeam: true, awayTeam: true },
          take: 500,
          orderBy: { date: 'desc' },
        })
        if (dbMatches.length > 0) {
          data = dbMatches.map((m) => ({
            date: m.date?.toISOString().split('T')[0] || '',
            home_team: m.homeTeam?.name || '',
            away_team: m.awayTeam?.name || '',
            home_score: m.homeScore,
            away_score: m.awayScore,
            status: m.status,
            competition: m.competition,
            source: m.source,
          }))
        } else {
          // Fallback: fetch from ESPN
          try {
            const espnMatches = await fetchAllLiveScores()
            data = espnMatches.map((m: any) => ({
              date: m.date || '',
              home_team: m.homeTeam?.name || '',
              away_team: m.awayTeam?.name || '',
              home_score: m.homeScore ?? 0,
              away_score: m.awayScore ?? 0,
              status: m.status || '',
              competition: m.competition || '',
              source: 'espn',
            }))
          } catch {
            data = []
          }
        }
        filename = `elastico-matches-${Date.now()}`
        break
      }
      case 'players': {
        const dbPlayers = await db.player.findMany({
          include: { team: true },
          take: 500,
          orderBy: { goals: 'desc' },
        })
        if (dbPlayers.length > 0) {
          data = dbPlayers.map((p) => ({
            name: p.name,
            position: p.position,
            age: p.age,
            nationality: p.nationality,
            goals: p.goals,
            assists: p.assists,
            appearances: p.appearances,
            rating: p.rating,
            team: p.team?.name || '',
            source: p.source,
          }))
        }
        filename = `elastico-players-${Date.now()}`
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
        const dbTeams = await db.team.findMany({
          take: 500,
          orderBy: { name: 'asc' },
        })
        if (dbTeams.length > 0) {
          data = dbTeams.map((t) => ({
            name: t.name,
            code: t.code,
            league: t.league || '',
            elo_rating: t.eloRating,
            wins: t.wins,
            draws: t.draws,
            losses: t.losses,
            goals_for: t.goalsFor,
            goals_against: t.goalsAgainst,
            source: t.source,
          }))
        }
        filename = `elastico-teams-${Date.now()}`
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
    }

    if (exportFormat === 'csv') {
      if (data.length === 0) {
        return NextResponse.json({
          error: `No ${exportType} data available to export. Try syncing data first.`,
        }, { status: 404 })
      }
      const headers = Object.keys(data[0] as Record<string, unknown>)
      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          headers.map((h) => {
            const val = String((row as Record<string, unknown>)[h] ?? '')
            // Proper CSV escaping: wrap in quotes if contains comma, quote, or newline
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
              return `"${val.replace(/"/g, '""')}"`
            }
            return val
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
