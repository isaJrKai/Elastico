import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { fetchAllLiveScores, mapStatus, type ESPNMatch } from '@/lib/football-data'
import { fetchTodaysMatches, normalizeFDMatch } from '@/lib/football-data-org'
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

    // Normalize without inventing labels or scores for missing provider fields.
    const normalized = matches.map((m: any) => ({
      id: m.id,
      competition: m.competition,
      homeTeam: {
        id: m.homeTeam?.id || '',
        name: m.homeTeam?.name || '',
        abbreviation: m.homeTeam?.abbreviation || m.homeTeam?.code || '',
      },
      awayTeam: {
        id: m.awayTeam?.id || '',
        name: m.awayTeam?.name || '',
        abbreviation: m.awayTeam?.abbreviation || m.awayTeam?.code || '',
      },
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      status: matchSource === 'espn' ? mapStatus(m.status || '') : m.status,
      date: m.date || m.utcDate || '',
      venue: m.venue || '',
      minute: m.minute ?? null,
    }))

    // Drop incomplete fixture records rather than showing fictitious team names.
    const validFixtures = normalized.filter((m: any) =>
      Boolean(m.id && m.homeTeam.name && m.awayTeam.name && m.date)
    )
    const invalidFixtureCount = normalized.length - validFixtures.length

    // Only emit predictions when both teams have an explicitly curated rating.
    // Unknown teams are reported as skipped; never synthesize strength from a name/hash.
    // Never generate a pre-match forecast for live, finished, postponed, or
    // undated fixtures. This also prevents post-kickoff information leakage.
    const upcomingFixtures = validFixtures.filter((m: any) =>
      m.status === 'upcoming' && Number.isFinite(Date.parse(m.date)) && Date.parse(m.date) > Date.now()
    )
    const ignoredNonUpcomingCount = validFixtures.length - upcomingFixtures.length
    const supportedMatches = upcomingFixtures.filter((m: any) =>
      Object.prototype.hasOwnProperty.call(TEAM_ELO_MAP, m.homeTeam.abbreviation) &&
      Object.prototype.hasOwnProperty.call(TEAM_ELO_MAP, m.awayTeam.abbreviation)
    )
    const skippedMatches = upcomingFixtures
      .filter((m: any) =>
        !Object.prototype.hasOwnProperty.call(TEAM_ELO_MAP, m.homeTeam.abbreviation) ||
        !Object.prototype.hasOwnProperty.call(TEAM_ELO_MAP, m.awayTeam.abbreviation)
      )
      .map((m: any) => ({
        matchId: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        reason: 'No curated rating for one or both teams; prediction withheld.',
      }))

    // Take up to 20 supported fixtures. Ratings below are static curated offsets,
    // not dynamically updated ELO ratings; do not present this as a validated model.
    const predictions = supportedMatches.slice(0, 20).map((m: any) => {
      const homeAbbr = m.homeTeam.abbreviation
      const awayAbbr = m.awayTeam.abbreviation
      const homeElo = 1500 + TEAM_ELO_MAP[homeAbbr]
      const awayElo = 1500 + TEAM_ELO_MAP[awayAbbr]

      // 1. ELO Model
      const elo: EloResult = calculateElo(homeElo, awayElo, 20, 0)

      // 2. Poisson Model
      const poisson = poissonProbabilities(
        elo.expectedHomeGoals, elo.expectedAwayGoals
      )

      // 3. Dixon-Coles Model
      const dc = dixonColes(
        elo.expectedHomeGoals, elo.expectedAwayGoals, 0.1, -0.1, 0.1, 0.0
      )

      // Ensemble: average of 3 models (no stochastic — requires real odds)
      const ensemble = {
        homeWin: (elo.homeProb + poisson.homeWinProb + dc.homeWinProb) / 3,
        draw: (elo.drawProb + poisson.drawProb + dc.drawProb) / 3,
        awayWin: (elo.awayProb + poisson.awayWinProb + dc.awayWinProb) / 3,
      }

      // Normalize to 100%
      const total = ensemble.homeWin + ensemble.draw + ensemble.awayWin
      ensemble.homeWin = Math.round((ensemble.homeWin / total) * 1000) / 10
      ensemble.draw = Math.round((ensemble.draw / total) * 1000) / 10
      ensemble.awayWin = Math.round((ensemble.awayWin / total) * 1000) / 10

      // Most likely scoreline (from Poisson)
      const mls = poisson.mostLikelyScore

      return {
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
        // Predictions
        ensemble,
        elo: { home: Math.round(elo.homeProb * 1000) / 10, draw: Math.round(elo.drawProb * 1000) / 10, away: Math.round(elo.awayProb * 1000) / 10, expHome: elo.expectedHomeGoals.toFixed(2), expAway: elo.expectedAwayGoals.toFixed(2) },
        poisson: { home: Math.round(poisson.homeWinProb * 1000) / 10, draw: Math.round(poisson.drawProb * 1000) / 10, away: Math.round(poisson.awayWinProb * 1000) / 10, over25: Math.round(poisson.overProb * 1000) / 10, btts: Math.round(poisson.bttsProb * 1000) / 10 },
        dixonColes: { home: Math.round(dc.homeWinProb * 1000) / 10, draw: Math.round(dc.drawProb * 1000) / 10, away: Math.round(dc.awayWinProb * 1000) / 10 },
        // Markets (from Poisson — does not require odds)
        overUnder25: Math.round(poisson.overProb * 1000) / 10,
        btts: Math.round(poisson.bttsProb * 1000) / 10,
        // Most likely score
        mostLikelyScore: `${mls.home}-${mls.away}`,
        // Expected goals (from ELO)
        expectedGoals: { home: elo.expectedHomeGoals.toFixed(2), away: elo.expectedAwayGoals.toFixed(2), total: (elo.expectedHomeGoals + elo.expectedAwayGoals).toFixed(2) },
      }
    })

    return NextResponse.json({
      success: true,
      count: predictions.length,
      source: matchSource,
      ratingSource: 'static-curated-team-offsets',
      modelStatus: 'experimental-unvalidated',
      invalidFixtureCount,
      ignoredNonUpcomingCount,
      skippedCount: skippedMatches.length,
      skippedMatches,
      predictions,
    })
  } catch (error) {
    console.error('[PREDICT] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

// Static, manually curated offsets for a limited set of team abbreviations.
// These are not live ratings and must be replaced by a trained/updating rating source
// before this endpoint is used for production-grade betting analysis.
const TEAM_ELO_MAP: Record<string, number> = {
  // Premier League
  'MCI': 380, 'ARS': 360, 'LIV': 370, 'MUN': 320, 'CHE': 340, 'NEW': 310, 'TOT': 300, 'AVL': 290,
  'BOU': 270, 'BHA': 260, 'WHU': 250, 'CRY': 240, 'FUL': 250, 'WOL': 230, 'BUR': 220, 'EVE': 230,
  'NFO': 260, 'BRE': 250, 'SOU': 210, 'LEI': 240, 'IPS': 200, 'SUN': 190,
  // La Liga
  'RMA': 390, 'BAR': 380, 'ATM': 350, 'SEV': 300, 'RSO': 310, 'VIL': 300, 'BET': 280, 'CEL': 260,
  'ATH': 270, 'VAL': 260, 'OSA': 230, 'GET': 240, 'MLL': 220, 'CAD': 200, 'UDL': 210, 'LEV_LIGA': 250,
  // Serie A
  'INT': 360, 'NAP': 350, 'JUV': 340, 'ACM': 350, 'ROM': 310, 'LAZ': 300, 'ATA': 290, 'FIO': 270,
  'BOL': 260, 'TOR': 260, 'MON_SSA': 240, 'UDI': 230, 'SAS': 220, 'EMP': 230, 'CAG': 200, 'LEC': 190,
  'PAR': 210, 'GEN': 220, 'VER': 200, 'VEN': 210, 'COM': 190, 'CAL': 180,
  // Bundesliga
  'BAY': 380, 'DOR': 340, 'B04': 330, 'STU': 310, 'EIN': 300, 'FRE': 290, 'HOF': 280, 'WOB': 270,
  'UNB': 260, 'M05': 260, 'BSC': 250, 'AUG': 240, 'MGL': 230, 'KOE': 240, 'DAR': 220, 'BOC': 210,
  // Ligue 1
  'PSG': 380, 'ASM': 340, 'OL': 310, 'OM': 300, 'LYO': 290, 'NCE': 280, 'LEN': 260, 'REN': 260,
  'ASM_L1': 340, 'LIL': 270, 'STR': 240, 'TOU': 230, 'REI': 220, 'MET': 210, 'NAN': 210, 'LER': 200,
  'ANG': 200, 'AUX': 210, 'LEH': 190, 'BRE_L1': 220, 'MHS': 200,
}

// Deliberately no fallback rating: unsupported teams must not receive synthetic strength.

export const dynamic = 'force-dynamic'
