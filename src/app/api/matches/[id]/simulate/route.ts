import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores } from '@/lib/football-data'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// Simple ELO-based simulation using team names from ESPN data.
// Since matches are now ESPN-live, simulation works on ESPN match data.

function computeEloFromName(name: string): number {
  // Well-known teams get realistic base ELOs; others get a default.
  const eloMap: Record<string, number> = {
    'Argentina': 1910, 'France': 1870, 'Spain': 1890, 'England': 1850,
    'Brazil': 1840, 'Germany': 1830, 'Portugal': 1820, 'Netherlands': 1790,
    'Italy': 1770, 'Uruguay': 1750, 'Japan': 1680, 'USA': 1660,
    'Mexico': 1640, 'South Korea': 1650, 'Colombia': 1710, 'Croatia': 1720,
    'Belgium': 1780, 'Denmark': 1700, 'Switzerland': 1690, 'Austria': 1670,
    'Turkey': 1645, 'Serbia': 1630, 'Senegal': 1620, 'Morocco': 1665,
    'Australia': 1590, 'Canada': 1610, 'Chile': 1600, 'Ecuador': 1580,
    'Peru': 1560, 'Paraguay': 1550, 'Venezuela': 1530, 'Nigeria': 1595,
    'Egypt': 1545, 'Tunisia': 1535, 'Ghana': 1540, 'Cameroon': 1525,
  }
  return eloMap[name] || 1500
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const { id } = await params

    // Find the match in ESPN live data
    const allMatches = await fetchAllLiveScores()
    const espnMatch = allMatches.find((m) => m.id === id)

    if (!espnMatch) {
      return NextResponse.json({ error: 'Match not found in ESPN data. Simulation is available for upcoming ESPN matches.' }, { status: 404 })
    }

    if (espnMatch.status !== 'STATUS_SCHEDULED') {
      return NextResponse.json({ error: 'Can only simulate upcoming matches' }, { status: 400 })
    }

    // Compute ELO from team names
    const homeElo = computeEloFromName(espnMatch.homeTeam.name)
    const awayElo = computeEloFromName(espnMatch.awayTeam.name)
    const homeStrength = homeElo / (homeElo + awayElo)
    const awayStrength = 1 - homeStrength

    // Simulate 90 minutes
    let homeScore = 0
    let awayScore = 0
    let currentMinute = 0
    const events: { minute: number; type: string; team: string; playerName: string; description: string }[] = []

    while (currentMinute < 90) {
      const rand = Math.random()

      if (rand < 0.035) {
        // Goal ~3.5% per minute
        currentMinute = Math.min(currentMinute + Math.floor(Math.random() * 15) + 1, 90)
        const isHome = Math.random() < homeStrength * 1.1
        const scorerTeam = isHome ? 'home' : 'away'
        const scorerName = isHome ? espnMatch.homeTeam.name : espnMatch.awayTeam.name
        if (isHome) homeScore++
        else awayScore++
        events.push({
          minute: currentMinute,
          type: 'goal',
          team: scorerTeam,
          playerName: scorerName,
          description: `GOAL! Goal for ${scorerName}!`,
        })
      } else if (rand < 0.07) {
        // Yellow card
        currentMinute = Math.min(currentMinute + Math.floor(Math.random() * 12) + 1, 90)
        const isHome = Math.random() < 0.5
        const team = isHome ? espnMatch.homeTeam.name : espnMatch.awayTeam.name
        events.push({
          minute: currentMinute,
          type: 'yellow_card',
          team: isHome ? 'home' : 'away',
          playerName: team,
          description: `Yellow card for ${team}`,
        })
      } else {
        currentMinute += Math.floor(Math.random() * 5) + 3
      }
    }

    events.push({
      minute: 45,
      type: 'var_review',
      team: 'home',
      playerName: 'System',
      description: 'Half Time',
    })

    events.sort((a, b) => a.minute - b.minute)

    // Compute stats
    const homeXg = Math.round((homeStrength * 2.5 + Math.random() * 0.8) * 100) / 100
    const awayXg = Math.round((awayStrength * 2.5 + Math.random() * 0.8) * 100) / 100
    const possessionHome = Math.round(45 + (homeStrength - 0.5) * 20 + Math.random() * 5)

    const result = {
      match: {
        id: espnMatch.id,
        homeTeam: espnMatch.homeTeam,
        awayTeam: espnMatch.awayTeam,
        status: 'finished',
        homeScore,
        awayScore,
        homeXg,
        awayXg,
        possessionHome,
        possessionAway: 100 - possessionHome,
        shotsHome: Math.round(homeStrength * 15 + Math.random() * 5),
        shotsAway: Math.round(awayStrength * 15 + Math.random() * 5),
        shotsOnTargetHome: homeScore + Math.floor(Math.random() * 4) + 1,
        shotsOnTargetAway: awayScore + Math.floor(Math.random() * 4) + 1,
        cornersHome: Math.round(Math.random() * 6) + 2,
        cornersAway: Math.round(Math.random() * 6) + 2,
        foulsHome: Math.round(Math.random() * 8) + 8,
        foulsAway: Math.round(Math.random() * 8) + 8,
        isSimulated: true,
        events,
      },
      eloBefore: { home: homeElo, away: awayElo },
    }

    // Evaluate any existing predictions for this match
    const predictions = await db.prediction.findMany({ where: { matchId: id } })
    const actualOutcome = homeScore > awayScore ? 'home' : homeScore === awayScore ? 'draw' : 'away'

    for (const pred of predictions) {
      const isCorrect = pred.predictedOutcome === actualOutcome
      const points = isCorrect ? Math.round(pred.confidence * 10) : 0

      await db.prediction.update({
        where: { id: pred.id },
        data: { isCorrect, points },
      })

      if (isCorrect) {
        const currentUser = await db.user.findUnique({ where: { id: pred.userId }, select: { bestStreak: true, predictionStreak: true } })
        const newStreak = (currentUser?.predictionStreak || 0) + 1
        await db.user.update({
          where: { id: pred.userId },
          data: {
            totalPredictions: { increment: 1 },
            correctPredictions: { increment: 1 },
            predictionStreak: { increment: 1 },
            bestStreak: Math.max(newStreak, currentUser?.bestStreak || 0),
          },
        })
        const updatedUser = await db.user.findUnique({ where: { id: pred.userId }, select: { totalPredictions: true, correctPredictions: true } })
        if (updatedUser && updatedUser.totalPredictions > 0) {
          await db.user.update({
            where: { id: pred.userId },
            data: { predictionAccuracy: Math.round((updatedUser.correctPredictions / updatedUser.totalPredictions) * 1000) / 100 },
          })
        }
      } else {
        await db.user.update({
          where: { id: pred.userId },
          data: {
            totalPredictions: { increment: 1 },
            predictionStreak: 0,
          },
        })
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}