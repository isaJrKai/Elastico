import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { fetchAllLiveScores } from '@/lib/football-data'
import { fetchTodaysMatches, normalizeFDMatch } from '@/lib/football-data-org'
import { db } from '@/lib/db'
import { calculateElo, poissonProbabilities, dixonColes, type EloResult } from '@/lib/predictions'

/** GET /api/predictions/compute — compute predictions from ESPN match data (auth required)
 *
 * Uses a 3-model ensemble (ELO + Poisson + Dixon-Coles).
 * The stochastic model (Merton Jump-Diffusion + GARCH) requires real bookmaker odds
 * to produce meaningful market-derived outputs. Since this endpoint fetches fixtures
 * from ESPN's scoreboard API (which does not include odds), we do not run the
 * stochastic model here. Users who want stochastic analysis should use the
 * Prediction Engine view, where they can provide real odds manually.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit: 5 requests per minute
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`predictions-compute:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // SECURITY: Require authentication to prevent CPU abuse
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    // Fetch matches: try football-data.org first (more reliable), then ESPN
    let matches: any[] = []
    let matchSource = 'espn'

    if (process.env.FOOTBALL_DATA_API_KEY) {
      try {
        const fdMatches = await fetchTodaysMatches()
        if (fdMatches.length > 0) {
          matches = fdMatches.map(normalizeFDMatch)
          matchSource = 'football-data.org'
        }
      } catch (err) {
        console.warn('[PREDICT] football-data.org failed, trying ESPN:', err)
      }
    }

    if (matches.length === 0) {
      matches = await fetchAllLiveScores()
      matchSource = 'espn'
    }

    // Normalize to common shape
    const normalized = matches.map((m: any) => ({
      id: m.id,
      competition: m.competition,
      homeTeam: {
        id: m.homeTeam?.id || '',
        name: m.homeTeam?.name || 'Home',
        abbreviation: m.homeTeam?.abbreviation || m.homeTeam?.code || '',
      },
      awayTeam: {
        id: m.awayTeam?.id || '',
        name: m.awayTeam?.name || 'Away',
        abbreviation: m.awayTeam?.abbreviation || m.awayTeam?.code || '',
      },
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      status: m.status,
      date: m.date || m.utcDate || '',
      venue: m.venue || '',
      minute: m.minute,
    }))

    // Use persisted team ratings/statistics when available. Never invent team strength
    // from a name hash: unknown teams are explicitly marked as neutral-baseline estimates.
    const storedTeams = await db.team.findMany({
      select: {
        name: true, code: true, eloRating: true, wins: true, draws: true, losses: true,
        goalsFor: true, goalsAgainst: true, source: true, lastSyncedAt: true,
      },
    })
    const normalizeName = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
    const findStoredTeam = (name: string, abbreviation: string) => {
      const normalizedName = normalizeName(name)
      return storedTeams.find(team => normalizeName(team.name) === normalizedName) ??
        (abbreviation ? storedTeams.find(team => team.code?.toUpperCase() === abbreviation.toUpperCase()) : undefined)
    }

    const predictionCandidates = normalized.slice(0, 40).map((m: any) => {
      const storedHome = findStoredTeam(m.homeTeam.name, m.homeTeam.abbreviation)
      const storedAway = findStoredTeam(m.awayTeam.name, m.awayTeam.abbreviation)
      const homePlayed = (storedHome?.wins ?? 0) + (storedHome?.draws ?? 0) + (storedHome?.losses ?? 0)
      const awayPlayed = (storedAway?.wins ?? 0) + (storedAway?.draws ?? 0) + (storedAway?.losses ?? 0)
      const isRecentlySynced = (team: typeof storedTeams[number] | undefined) => {
        if (!team?.lastSyncedAt) return false
        const ageMs = Date.now() - team.lastSyncedAt.getTime()
        return ageMs >= 0 && ageMs <= 45 * 24 * 60 * 60 * 1000
      }
      const homeHistoryAvailable = Boolean(storedHome && homePlayed > 0 && storedHome.source !== 'unknown' && storedHome.source !== 'seed' && storedHome.source !== 'demo' && isRecentlySynced(storedHome))
      const awayHistoryAvailable = Boolean(storedAway && awayPlayed > 0 && storedAway.source !== 'unknown' && storedAway.source !== 'seed' && storedAway.source !== 'demo' && isRecentlySynced(storedAway))
      if (!homeHistoryAvailable || !awayHistoryAvailable) {
        return {
          prediction: null,
          skipped: {
            matchId: m.id,
            homeTeam: m.homeTeam.name,
            awayTeam: m.awayTeam.name,
            reason: !homeHistoryAvailable && !awayHistoryAvailable
              ? 'Recent sourced team history is unavailable for both teams.'
              : !homeHistoryAvailable
                ? 'Recent sourced team history is unavailable for the home team.'
                : 'Recent sourced team history is unavailable for the away team.',
          },
        }
      }

      const homeElo = storedHome!.eloRating
      const awayElo = storedAway!.eloRating
      const elo: EloResult = calculateElo(homeElo, awayElo, 20, 65)
      const homeAttack = storedHome!.goalsFor / homePlayed
      const homeDefence = storedHome!.goalsAgainst / homePlayed
      const awayAttack = storedAway!.goalsFor / awayPlayed
      const awayDefence = storedAway!.goalsAgainst / awayPlayed
      const homeLambda = Math.max(0.2, Math.min(4, (homeAttack + awayDefence) / 2))
      const awayLambda = Math.max(0.2, Math.min(4, (awayAttack + homeDefence) / 2))
      const poisson = poissonProbabilities(homeLambda, awayLambda)
      const dc = dixonColes(homeLambda, awayLambda, 0.1, -0.1, 0.1, 0.0)
      const ensemble = {
        homeWin: (elo.homeProb + poisson.homeWinProb + dc.homeWinProb) / 3,
        draw: (elo.drawProb + poisson.drawProb + dc.drawProb) / 3,
        awayWin: (elo.awayProb + poisson.awayWinProb + dc.awayWinProb) / 3,
      }
      const total = ensemble.homeWin + ensemble.draw + ensemble.awayWin
      ensemble.homeWin = Math.round((ensemble.homeWin / total) * 1000) / 10
      ensemble.draw = Math.round((ensemble.draw / total) * 1000) / 10
      ensemble.awayWin = Math.round((ensemble.awayWin / total) * 1000) / 10
      const mls = poisson.mostLikelyScore

      return {
        prediction: {
          matchId: m.id,
          competition: m.competition,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          date: m.date,
          venue: m.venue,
          minute: m.minute,
          dataQuality: 'recent-sourced-team-history',
          modelStatus: 'statistical-baseline-not-trained-or-independently-validated',
          dataQualityDetails: {
            homeTeamHistoryAvailable: true,
            awayTeamHistoryAvailable: true,
            homeRatingSource: storedHome!.source,
            awayRatingSource: storedAway!.source,
            homeMatchesObserved: homePlayed,
            awayMatchesObserved: awayPlayed,
            homeLastSyncedAt: storedHome!.lastSyncedAt.toISOString(),
            awayLastSyncedAt: storedAway!.lastSyncedAt.toISOString(),
          },
          ensemble,
          elo: { home: Math.round(elo.homeProb * 1000) / 10, draw: Math.round(elo.drawProb * 1000) / 10, away: Math.round(elo.awayProb * 1000) / 10, expHome: homeLambda.toFixed(2), expAway: awayLambda.toFixed(2) },
          poisson: { home: Math.round(poisson.homeWinProb * 1000) / 10, draw: Math.round(poisson.drawProb * 1000) / 10, away: Math.round(poisson.awayWinProb * 1000) / 10, over25: Math.round(poisson.overProb * 1000) / 10, btts: Math.round(poisson.bttsProb * 1000) / 10 },
          dixonColes: { home: Math.round(dc.homeWinProb * 1000) / 10, draw: Math.round(dc.drawProb * 1000) / 10, away: Math.round(dc.awayWinProb * 1000) / 10 },
          overUnder25: Math.round(poisson.overProb * 1000) / 10,
          btts: Math.round(poisson.bttsProb * 1000) / 10,
          mostLikelyScore: `${mls.home}-${mls.away}`,
          expectedGoals: { home: homeLambda.toFixed(2), away: awayLambda.toFixed(2), total: (homeLambda + awayLambda).toFixed(2) },
        },
        skipped: null,
      }
    })
    const predictions = predictionCandidates.map((candidate: any) => candidate.prediction).filter(Boolean)
    const skippedMatches = predictionCandidates.map((candidate: any) => candidate.skipped).filter(Boolean)

    return NextResponse.json({ success: true, count: predictions.length, skippedCount: skippedMatches.length, source: matchSource, modelStatus: 'statistical-baseline-not-trained-or-independently-validated', predictions, skippedMatches })
  } catch (error) {
    console.error('[PREDICT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Prediction computation failed' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
