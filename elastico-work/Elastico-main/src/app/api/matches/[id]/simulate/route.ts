import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth

    // All authenticated users can run simulations (removed paywall for demo/pitch)

    const { id } = await params

    const match = await db.match.findUnique({
      where: { id },
      include: {
        homeTeam: { include: { players: true } },
        awayTeam: { include: { players: true } },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (match.status === 'finished') {
      return NextResponse.json({ error: 'Cannot simulate a finished match' }, { status: 400 })
    }

    // Start simulation
    const updatedMatch = await db.match.update({
      where: { id },
      data: {
        status: 'live',
        isSimulated: true,
        simulationMinute: 0,
        homeScore: 0,
        awayScore: 0,
      },
    })

    // Generate random events based on team strength
    const homeElo = match.homeTeam.eloRating
    const awayElo = match.awayTeam.eloRating
    const homeStrength = homeElo / (homeElo + awayElo)
    const awayStrength = 1 - homeStrength

    const homePlayers = match.homeTeam.players
    const awayPlayers = match.awayTeam.players

    const homeForwards = homePlayers.filter((p) => p.position === 'FWD' || p.position === 'MID')
    const awayForwards = awayPlayers.filter((p) => p.position === 'FWD' || p.position === 'MID')
    const homeDefenders = homePlayers.filter((p) => p.position === 'DEF')
    const awayDefenders = awayPlayers.filter((p) => p.position === 'DEF')

    let homeScore = 0
    let awayScore = 0
    let currentMinute = 0
    const events: { matchId: string; minute: number; type: string; team: string; playerName: string; playerId: string | null; description: string | null }[] = []

    // Simulate 90 minutes
    while (currentMinute < 90) {
      // Event probability per minute
      const rand = Math.random()

      if (rand < 0.035) {
        // Goal event ~3.5% per minute
        currentMinute = Math.min(currentMinute + Math.floor(Math.random() * 15) + 1, 90)
        const isHome = Math.random() < homeStrength * 1.1 // slight home advantage

        if (isHome && homeForwards.length > 0) {
          const scorer = homeForwards[Math.floor(Math.random() * homeForwards.length)]
          homeScore++
          events.push({
            matchId: id,
            minute: currentMinute,
            type: 'goal',
            team: 'home',
            playerName: scorer.name,
            playerId: scorer.id,
            description: `GOAL! ${scorer.name} scores for ${match.homeTeam.name}!`,
          })
        } else if (awayForwards.length > 0) {
          const scorer = awayForwards[Math.floor(Math.random() * awayForwards.length)]
          awayScore++
          events.push({
            matchId: id,
            minute: currentMinute,
            type: 'goal',
            team: 'away',
            playerName: scorer.name,
            playerId: scorer.id,
            description: `GOAL! ${scorer.name} scores for ${match.awayTeam.name}!`,
          })
        }
      } else if (rand < 0.07) {
        // Yellow card
        currentMinute = Math.min(currentMinute + Math.floor(Math.random() * 12) + 1, 90)
        const isHome = Math.random() < 0.5
        const pool = isHome ? homeDefenders : awayDefenders
        if (pool.length > 0) {
          const fouler = pool[Math.floor(Math.random() * pool.length)]
          events.push({
            matchId: id,
            minute: currentMinute,
            type: 'yellow_card',
            team: isHome ? 'home' : 'away',
            playerName: fouler.name,
            playerId: fouler.id,
            description: `Yellow card for ${fouler.name}`,
          })
        }
      } else {
        currentMinute += Math.floor(Math.random() * 5) + 3
      }
    }

    // Add halftime event
    events.push({
      matchId: id,
      minute: 45,
      type: 'var_review',
      team: 'home',
      playerName: 'System',
      playerId: null,
      description: 'Half Time',
    })

    // Sort events by minute
    events.sort((a, b) => a.minute - b.minute)

    // Create all events in DB
    if (events.length > 0) {
      await db.matchEvent.createMany({ data: events })
    }

    // Update match with final score and stats
    const totalGoals = homeScore + awayScore
    const homeXg = Math.round((homeStrength * 2.5 + Math.random() * 0.8) * 100) / 100
    const awayXg = Math.round((awayStrength * 2.5 + Math.random() * 0.8) * 100) / 100
    const possessionHome = Math.round(45 + (homeStrength - 0.5) * 20 + Math.random() * 5)

    const finalMatch = await db.match.update({
      where: { id },
      data: {
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
        simulationMinute: 90,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        events: { orderBy: { minute: 'asc' } },
      },
    })

    // Update ELO ratings for both teams
    const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400))
    const actualHome = homeScore > awayScore ? 1 : homeScore === awayScore ? 0.5 : 0
    const kFactor = 32
    const newHomeElo = Math.round(homeElo + kFactor * (actualHome - expectedHome))
    const newAwayElo = Math.round(awayElo + kFactor * ((1 - actualHome) - (1 - expectedHome)))

    await db.team.update({ where: { id: match.homeTeamId }, data: { eloRating: newHomeElo } })
    await db.team.update({ where: { id: match.awayTeamId }, data: { eloRating: newAwayElo } })

    // Evaluate predictions
    const predictions = await db.prediction.findMany({ where: { matchId: id } })
    const actualOutcome = homeScore > awayScore ? 'home' : homeScore === awayScore ? 'draw' : 'away'

    for (const pred of predictions) {
      const isCorrect = pred.predictedOutcome === actualOutcome
      const points = isCorrect ? Math.round(pred.confidence * 10) : 0

      await db.prediction.update({
        where: { id: pred.id },
        data: { isCorrect, points },
      })

      // Update user stats using atomic increment to prevent race conditions
      if (isCorrect) {
        // Fetch current bestStreak to compare
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
        // Recalculate accuracy as a separate operation
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

    // Update team records
    await db.team.update({
      where: { id: match.homeTeamId },
      data: {
        wins: { increment: homeScore > awayScore ? 1 : 0 },
        draws: { increment: homeScore === awayScore ? 1 : 0 },
        losses: { increment: homeScore < awayScore ? 1 : 0 },
        goalsFor: { increment: homeScore },
        goalsAgainst: { increment: awayScore },
      },
    })
    await db.team.update({
      where: { id: match.awayTeamId },
      data: {
        wins: { increment: awayScore > homeScore ? 1 : 0 },
        draws: { increment: homeScore === awayScore ? 1 : 0 },
        losses: { increment: awayScore < homeScore ? 1 : 0 },
        goalsFor: { increment: awayScore },
        goalsAgainst: { increment: homeScore },
      },
    })

    return NextResponse.json({ match: finalMatch })
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}