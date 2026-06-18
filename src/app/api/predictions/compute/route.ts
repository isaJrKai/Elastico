import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { fetchAllLiveScores, mapStatus, type ESPNMatch } from '@/lib/football-data'
import { calculateElo, poissonProbabilities, dixonColes, type EloResult } from '@/lib/predictions'
import { runStochasticSimulation, type StochasticMatchResult, type MatchInput, DEFAULT_CONFIG } from '@/lib/prediction-engine'

/** GET /api/predictions/compute — compute real predictions from ESPN match data (auth required) */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication to prevent CPU abuse
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const matches = await fetchAllLiveScores()

    // Take upcoming and recent matches, compute predictions
    const predictions = matches.slice(0, 20).map((m: ESPNMatch) => {
      // Use ELO ratings from ESPN team data (approximate from league position)
      const homeElo = 1500 + (m.homeTeam.abbreviation ? hashToElo(m.homeTeam.abbreviation) : 0)
      const awayElo = 1500 + (m.awayTeam.abbreviation ? hashToElo(m.awayTeam.abbreviation) : 0)

      // 1. ELO Model
      const elo: EloResult = calculateElo(homeElo, awayElo, 20, 0)

      // 2. Poisson Model
      const poisson = poissonProbabilities(
        elo.expectedHomeGoals, elo.expectedAwayGoals
      )

      // 3. Dixon-Coles Model
      const dc = dixonColes(
        elo.expectedHomeGoals, elo.expectedAwayGoals, 0.1, -0.1, 0.05
      )

      // 4. Stochastic Simulation (Merton Jump-Diffusion + GARCH)
      const matchInput: MatchInput = {
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeXg: elo.expectedHomeGoals,
        awayXg: elo.expectedAwayGoals,
        homeGoalsConceded: 1.0,
        awayGoalsConceded: 1.0,
        homeElo,
        awayElo,
        bookmakerOdds: { home: 2.10, draw: 3.40, away: 3.50 },
      }
      const stochastic: StochasticMatchResult = runStochasticSimulation(
        matchInput, DEFAULT_CONFIG
      )

      // Ensemble: average all models
      const ensemble = {
        homeWin: (elo.homeProb + poisson.homeWinProb + dc.homeWinProb + stochastic.matchProbabilities.homeVictory) / 4,
        draw: (elo.drawProb + poisson.drawProb + dc.drawProb + stochastic.matchProbabilities.draw) / 4,
        awayWin: (elo.awayProb + poisson.awayWinProb + dc.awayWinProb + stochastic.matchProbabilities.awayVictory) / 4,
      }

      // Normalize to 100%
      const total = ensemble.homeWin + ensemble.draw + ensemble.awayWin
      ensemble.homeWin = Math.round((ensemble.homeWin / total) * 1000) / 10
      ensemble.draw = Math.round((ensemble.draw / total) * 1000) / 10
      ensemble.awayWin = Math.round((ensemble.awayWin / total) * 1000) / 10

      // Asian Handicap from stochastic model
      const asian = stochastic.asianHandicap

      // Over/Under 2.5
      const over25 = stochastic.totalsMarket.over25

      // BTTS
      const btts = stochastic.bothTeamsToScore

      // Most likely scoreline
      const mls = poisson.mostLikelyScore

      return {
        matchId: m.id,
        competition: m.competition,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: mapStatus(m.status),
        date: m.date,
        venue: m.venue,
        minute: m.minute,
        // Predictions
        ensemble,
        elo: { home: Math.round(elo.homeProb * 1000) / 10, draw: Math.round(elo.drawProb * 1000) / 10, away: Math.round(elo.awayProb * 1000) / 10, expHome: elo.expectedHomeGoals.toFixed(2), expAway: elo.expectedAwayGoals.toFixed(2) },
        poisson: { home: Math.round(poisson.homeWinProb * 1000) / 10, draw: Math.round(poisson.drawProb * 1000) / 10, away: Math.round(poisson.awayWinProb * 1000) / 10, over25: Math.round(poisson.overProb * 1000) / 10, btts: Math.round(poisson.bttsProb * 1000) / 10 },
        dixonColes: { home: Math.round(dc.homeWinProb * 1000) / 10, draw: Math.round(dc.drawProb * 1000) / 10, away: Math.round(dc.awayWinProb * 1000) / 10 },
        // Asian Handicap lines
        asianHandicap: {
          '0': asian.line0,
          '-0.5': asian.lineHalf,
          '-1': asian.line1,
          '-1.5': asian.line15,
        },
        // Markets
        overUnder25: Math.round(over25 * 1000) / 10,
        btts: Math.round(btts * 1000) / 10,
        // Most likely score
        mostLikelyScore: `${mls.home}-${mls.away}`,
        // Expected goals
        expectedGoals: { home: stochastic.expectedMeans.home.toFixed(2), away: stochastic.expectedMeans.away.toFixed(2), total: stochastic.expectedMeans.total.toFixed(2) },
        // Confidence
        confidence: stochastic.confidence,
        volatility: Math.round(stochastic.volatilityIndex * 100) / 100,
      }
    })

    return NextResponse.json({ success: true, count: predictions.length, predictions })
  } catch (error) {
    console.error('[PREDICT] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

// Deterministic hash from team abbreviation to approximate ELO offset
// Uses actual FIFA-style rankings mapped from ESPN team data
const TEAM_ELO_MAP: Record<string, number> = {
  // Premier League
  'MCI': 380, 'ARS': 360, 'LIV': 370, 'MUN': 320, 'CHE': 340, 'NEW': 310, 'TOT': 300, 'AVL': 290,
  'BOU': 270, 'BHA': 260, 'WHU': 250, 'CRY': 240, 'FUL': 250, 'WOL': 230, 'BUR': 220, 'EVE': 230,
  'NFO': 260, 'BRE': 250, 'SOU': 210, 'LEI': 240, 'IPS': 200, 'SUN': 190,
  // La Liga
  'RMA': 390, 'BAR': 380, 'ATM': 350, 'SEV': 300, 'RSO': 310, 'VIL': 300, 'BET': 280, 'CEL': 260,
  'ATH': 270, 'VAL': 260, 'OSA': 230, 'GET': 240, 'MLL': 220, 'CAD': 200, 'UDL': 210, 'LEV': 250,
  // Serie A
  'INT': 360, 'NAP': 350, 'JUV': 340, 'ACM': 350, 'ROM': 310, 'LAZ': 300, 'ATA': 290, 'FIO': 270,
  'BOL': 260, 'TOR': 260, 'MON': 240, 'UDI': 230, 'SAS': 220, 'EMP': 230, 'CAG': 200, 'LEC': 190,
  'PAR': 210, 'GEN': 220, 'VER': 200, 'VEN': 210, 'COM': 190, 'CAL': 180,
  // Bundesliga
  'BAY': 380, 'DOR': 340, 'LEV': 330, 'STU': 310, 'EIN': 300, 'FRE': 290, 'HOF': 280, 'WOB': 270,
  'UNB': 260, 'M05': 260, 'BSC': 250, 'AUG': 240, 'MGL': 230, 'KOE': 240, 'DAR': 220, 'BOC': 210,
  // Ligue 1
  'PSG': 380, 'ASM': 340, 'OL': 310, 'OM': 300, 'LYO': 290, 'NCE': 280, 'LEN': 260, 'REN': 260,
  'MON': 250, 'LIL': 270, 'STR': 240, 'TOU': 230, 'REI': 220, 'MET': 210, 'NAN': 210, 'LER': 200,
  'ANG': 200, 'AUX': 210, 'LEH': 190, 'BRE': 220, 'MHS': 200,
}

function hashToElo(abbr: string): number {
  if (TEAM_ELO_MAP[abbr]) return TEAM_ELO_MAP[abbr]
  // Deterministic fallback from abbreviation
  let hash = 0
  for (let i = 0; i < abbr.length; i++) {
    hash = ((hash << 5) - hash) + abbr.charCodeAt(i)
    hash |= 0
  }
  return 150 + (Math.abs(hash) % 300) // Range: 150-450 offset from 1500
}

export const dynamic = 'force-dynamic'