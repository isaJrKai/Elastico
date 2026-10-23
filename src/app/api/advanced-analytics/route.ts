import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  calculateCRI,
  calculateSCS,
  calculateITI,
  calculateRefereeDrift,
  calculateCRD,
  calculateFCD,
  calculateReintegration,
  calculateMAI,
  calculateDSE,
  calculateSBDI,
  calculatePressLag,
  calculateSOA,
  calculateLineAlpha,
  calculateRBEI,
  calculateCTC,
  calculateNarrativeMomentum,
  calculateCAPZ,
  calculateTAD,
  calculateSubDecay,
  calculateIPR,
  runFullAdvancedAnalysis,
  type FullAdvancedAnalysisParams,
} from '@/lib/advanced-analytics-engine'

/**
 * /api/advanced-analytics
 *
 * 20 proprietary sports analytics formulas across 5 tiers.
 * GET  ?action=<name> for single formulas with query params
 * POST { action, ...params } for complex nested payloads
 *
 * TIER 1 — Psychological: cri, scs, iti, referee-drift
 * TIER 2 — Temporal: crd, fcd, reintegration, mai
 * TIER 3 — Tactical: dse, sbdi, press-lag, soa
 * TIER 4 — Market: line-alpha, rbei, ctc, narrative
 * TIER 5 — Abyss: capz, tad, sub-decay, ipr
 * COMPOSITE: full, list
 */

/**
 * These formulas are exploratory heuristics, not validated football forecasts.
 * Preserve result fields for existing consumers while making that limitation
 * machine-readable in every successful response.
 */
function withExperimentalMetadata(result: unknown, action: string) {
  const payload = result && typeof result === 'object' && !Array.isArray(result)
    ? result as Record<string, unknown>
    : { value: result }

  return {
    ...payload,
    formulaAction: action,
    modelStatus: 'experimental-unvalidated',
    validatedAgainstHistoricalResults: false,
    inputsMayIncludeRouteDefaults: true,
    warning: 'Exploratory formula output only. Some GET parameters default to illustrative values; outputs have not been validated against historical match outcomes and are not production betting predictions.',
  }
}

const FORMULA_CATALOG = [
  { action: 'cri', tier: 1, name: 'Coach Risk Index', description: 'Prospect Theory applied to coaching decisions. Loss-averse value function x probability weighting x time pressure.' },
  { action: 'scs', tier: 1, name: 'Social Contagion Score', description: 'Emotional momentum propagation across a team. How fast does celebration/despair spread and affect performance?' },
  { action: 'iti', tier: 1, name: 'Identity Threat Index', description: 'Public criticism performance suppression based on Big Five neuroticism and resilience baseline.' },
  { action: 'referee-drift', tier: 1, name: 'Referee Behavioral Drift', description: 'Fatigue, crowd noise, and recency correction model. Detects subconscious bias patterns.' },
  { action: 'crd', tier: 2, name: 'Circadian Rhythm Decay', description: 'Timezone travel performance effects. Directional (East to West vs West to East) and position-specific.' },
  { action: 'fcd', tier: 2, name: 'Fixture Congestion Decay', description: 'Non-linear fatigue from condensed schedule. Exponential decay, position-weighted.' },
  { action: 'reintegration', tier: 2, name: 'Reintegration Readiness', description: 'Injury return readiness using training load x match minutes x opponent intensity.' },
  { action: 'mai', tier: 2, name: 'Motivation Index', description: 'Schedule-adjusted motivation gap. Quantifies dead rubber vs must-win asymmetry.' },
  { action: 'dse', tier: 3, name: 'Defensive Shape Entropy', description: 'Formation-breakdown heuristic computed from supplied player-position and zone data. No causal effect size has been validated.' },
  { action: 'sbdi', tier: 3, name: 'Second-Ball Dominance', description: 'Second-ball dominance index computed from supplied duel/recovery inputs. Any relationship to match outcomes remains unvalidated.' },
  { action: 'press-lag', tier: 3, name: 'Press Trigger Lag', description: 'Press execution-delay index based on supplied event timings. Thresholds require empirical validation.' },
  { action: 'soa', tier: 3, name: 'Spatial Overload Asymmetry', description: 'Gap between intended tactical overloads and actual player positioning.' },
  { action: 'line-alpha', tier: 4, name: 'Line Movement Alpha', description: 'Experimental line-movement signal from supplied odds history; it cannot verify bettor identity or establish that sharp money caused a movement.' },
  { action: 'rbei', tier: 4, name: 'Recency Bias Exploitation', description: 'Experimental recency-bias index from supplied market and form inputs; no betting threshold is validated.' },
  { action: 'ctc', tier: 4, name: 'Coaching Tenure Curve', description: 'Experimental coaching-tenure curve; time windows and turnover effects require historical validation.' },
  { action: 'narrative', tier: 4, name: 'Narrative Momentum', description: 'Experimental narrative-momentum heuristic; the coefficient is an assumption, not an established causal estimate.' },
  { action: 'capz', tier: 5, name: 'Crowd Acoustic Pressure', description: 'Experimental crowd-acoustic heuristic. No causal error-rate effect size is validated.' },
  { action: 'tad', tier: 5, name: 'Tactical Plagiarism Detection', description: 'Experimental tactical-similarity heuristic; thresholds require validated tactical tracking data.' },
  { action: 'sub-decay', tier: 5, name: 'Substitution Impact Decay', description: 'Experimental substitution-impact decay curve; time constants are assumptions requiring validation.' },
  { action: 'ipr', tier: 5, name: 'Psychological Residue', description: 'Inter-game hangover model. Experimental psychological-residue heuristic; claimed effects are not validated against historical outcomes.' },
]

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = rateLimit(`advanced-analytics-get:${ip}`, 15, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (!action) {
    return NextResponse.json({
      error: 'Missing ?action= parameter',
      available: FORMULA_CATALOG.map(f => f.action),
      tiers: {
        1: 'Psychological & Behavioral',
        2: 'Temporal & Context',
        3: 'Tactical Blindspots',
        4: 'Market & Meta-Game',
        5: 'The Abyss',
      },
    }, { status: 400 })
  }

  try {
    // ─── CATALOG ─────────────────────────────────────────────────────────
    if (action === 'list') {
      return NextResponse.json({ formulas: FORMULA_CATALOG, total: FORMULA_CATALOG.length, modelStatus: 'experimental-unvalidated', validatedAgainstHistoricalResults: false, warning: 'Formula catalog only; no empirical performance claims are established.' })
    }

    // ─── TIER 1: PSYCHOLOGICAL ───────────────────────────────────────────

    if (action === 'cri') {
      const result = calculateCRI({
        scoreDifferential: parseFloat(searchParams.get('scoreDiff') ?? '0'),
        probability: parseFloat(searchParams.get('prob') ?? '0.5'),
        outcomeMagnitude: parseFloat(searchParams.get('outcome') ?? '0.5'),
        minutesRemaining: parseInt(searchParams.get('minutes') ?? '45'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'scs') {
      const rawTeammates = searchParams.get('teammates')
      const teammates = rawTeammates
        ? JSON.parse(rawTeammates)
        : [
            { playerId: 'p2', socialProximity: 0.8, physicalProximity: 0.6 },
            { playerId: 'p3', socialProximity: 0.5, physicalProximity: 0.9 },
            { playerId: 'p4', socialProximity: 0.3, physicalProximity: 0.2 },
            { playerId: 'p5', socialProximity: 0.9, physicalProximity: 0.4 },
          ]
      const result = calculateSCS({
        triggerEvent: {
          playerId: searchParams.get('triggerPlayer') ?? 'p1',
          intensity: parseFloat(searchParams.get('intensity') ?? '0.8'),
          minute: parseInt(searchParams.get('triggerMinute') ?? '30'),
          valence: parseInt(searchParams.get('valence') ?? '1') === -1 ? -1 : 1,
        },
        teammates,
        currentMinute: parseInt(searchParams.get('currentMinute') ?? '35'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'iti') {
      const result = calculateITI({
        criticismMagnitude: parseFloat(searchParams.get('criticism') ?? '0.7'),
        neuroticismScore: parseFloat(searchParams.get('neuroticism') ?? '0.6'),
        resilienceBaseline: parseFloat(searchParams.get('resilience') ?? '0.5'),
        daysSinceCriticism: parseInt(searchParams.get('days') ?? '2'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'referee-drift') {
      const result = calculateRefereeDrift({
        minute: parseInt(searchParams.get('minute') ?? '70'),
        lastCall: (parseInt(searchParams.get('lastCall') ?? '0')) as -1 | 0 | 1,
        lastCallControversy: parseFloat(searchParams.get('controversy') ?? '0.5'),
        crowdNoise: parseFloat(searchParams.get('crowd') ?? '0.7'),
        homeBiasBaseline: parseFloat(searchParams.get('homeBias') ?? '0.15'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    // ─── TIER 2: TEMPORAL ───────────────────────────────────────────────

    if (action === 'crd') {
      const result = calculateCRD({
        basePerformance: parseFloat(searchParams.get('basePerf') ?? '0.75'),
        timeZonesCrossed: parseInt(searchParams.get('tz') ?? '3'),
        travelDirection: (searchParams.get('direction') ?? 'west-to-east') as 'east-to-west' | 'west-to-east',
        daysSinceArrival: parseInt(searchParams.get('daysArrival') ?? '2'),
        positionGroup: (searchParams.get('position') ?? 'striker') as 'striker' | 'midfielder' | 'defender' | 'goalkeeper',
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'fcd') {
      const rawMatchDays = searchParams.get('matchDays')
      const matchDays: number[] = rawMatchDays ? JSON.parse(rawMatchDays) : [0, 3, 6]
      const result = calculateFCD({ matchDays })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'reintegration') {
      const result = calculateReintegration({
        trainingLoadIndex: parseFloat(searchParams.get('trainingLoad') ?? '55'),
        matchMinutes: parseFloat(searchParams.get('matchMinutes') ?? '90'),
        highIntensityRuns: parseFloat(searchParams.get('hir') ?? '5'),
        opponentDefensiveIntensity: parseFloat(searchParams.get('oppIntensity') ?? '0.6'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'mai') {
      const result = calculateMAI({
        teamAStakes: parseFloat(searchParams.get('teamAStakes') ?? '0.8'),
        teamBStakes: parseFloat(searchParams.get('teamBStakes') ?? '0.1'),
        gameWeight: (searchParams.get('gameWeight') ?? 'high') as 'dead_rubber' | 'low' | 'medium' | 'high' | 'must_win',
        teamAForm: parseFloat(searchParams.get('teamAForm') ?? '1.8'),
        teamBForm: parseFloat(searchParams.get('teamBForm') ?? '1.2'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    // ─── TIER 3: TACTICAL ───────────────────────────────────────────────

    if (action === 'dse') {
      const rawPlayers = searchParams.get('players')
      const players = rawPlayers
        ? JSON.parse(rawPlayers)
        : [
            { playerId: 'gk', currentX: 0.05, currentY: 0.5, assignedZone: [0, 0.15, 0.3, 0.7] as [number, number, number, number] },
            { playerId: 'rb', currentX: 0.18, currentY: 0.85, assignedZone: [0.1, 0.3, 0.75, 1.0] as [number, number, number, number] },
            { playerId: 'cb1', currentX: 0.15, currentY: 0.35, assignedZone: [0.05, 0.3, 0.2, 0.5] as [number, number, number, number] },
            { playerId: 'cb2', currentX: 0.17, currentY: 0.65, assignedZone: [0.05, 0.3, 0.5, 0.8] as [number, number, number, number] },
            { playerId: 'lb', currentX: 0.2, currentY: 0.12, assignedZone: [0.1, 0.3, 0.0, 0.25] as [number, number, number, number] },
            { playerId: 'cm1', currentX: 0.4, currentY: 0.4, assignedZone: [0.25, 0.5, 0.3, 0.7] as [number, number, number, number] },
            { playerId: 'cm2', currentX: 0.42, currentY: 0.6, assignedZone: [0.25, 0.5, 0.3, 0.7] as [number, number, number, number] },
            { playerId: 'rw', currentX: 0.65, currentY: 0.85, assignedZone: [0.5, 0.8, 0.7, 1.0] as [number, number, number, number] },
            { playerId: 'lw', currentX: 0.7, currentY: 0.15, assignedZone: [0.5, 0.8, 0.0, 0.3] as [number, number, number, number] },
            { playerId: 'st', currentX: 0.85, currentY: 0.5, assignedZone: [0.75, 1.0, 0.35, 0.65] as [number, number, number, number] },
          ]
      const result = calculateDSE({ players, teamName: searchParams.get('teamName') ?? 'Team' })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'sbdi') {
      const result = calculateSBDI({
        totalContestedBalls: parseInt(searchParams.get('totalContested') ?? '45'),
        secondBallsWon: parseInt(searchParams.get('won') ?? '28'),
        territorialWeight: parseFloat(searchParams.get('territorial') ?? '0.7'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'press-lag') {
      const rawEvents = searchParams.get('events')
      const events = rawEvents
        ? JSON.parse(rawEvents)
        : [
            { triggerType: 'back_pass_to_keeper', lagSeconds: 1.8, oppositionTransitionSpeed: 0.7 },
            { triggerType: 'cb_under_pressure', lagSeconds: 2.5, oppositionTransitionSpeed: 0.8 },
            { triggerType: 'poor_touch', lagSeconds: 1.1, oppositionTransitionSpeed: 0.6 },
            { triggerType: 'slow_buildup', lagSeconds: 3.2, oppositionTransitionSpeed: 0.9 },
            { triggerType: 'back_pass_to_keeper', lagSeconds: 0.9, oppositionTransitionSpeed: 0.65 },
          ]
      const result = calculatePressLag({ pressEvents: events })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'soa') {
      const rawZones = searchParams.get('zones')
      const zones = rawZones
        ? JSON.parse(rawZones)
        : [
            { zoneId: 'left wing', intendedDensity: 2, actualDensity: 3.5 },
            { zoneId: 'left half-space', intendedDensity: 2, actualDensity: 1 },
            { zoneId: 'center', intendedDensity: 3, actualDensity: 3.2 },
            { zoneId: 'right half-space', intendedDensity: 2, actualDensity: 1.5 },
            { zoneId: 'right wing', intendedDensity: 2, actualDensity: 2 },
            { zoneId: 'left CB zone', intendedDensity: 2, actualDensity: 2.1 },
            { zoneId: 'right CB zone', intendedDensity: 2, actualDensity: 1.8 },
            { zoneId: 'midfield', intendedDensity: 3, actualDensity: 2.5 },
          ]
      const result = calculateSOA({ zones })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    // ─── TIER 4: MARKET ─────────────────────────────────────────────────

    if (action === 'line-alpha') {
      const result = calculateLineAlpha({
        totalLineMove: parseFloat(searchParams.get('totalMove') ?? '1.5'),
        publicMoneyEffect: parseFloat(searchParams.get('publicMoney') ?? '0.4'),
        injuryAdjustment: parseFloat(searchParams.get('injury') ?? '0.2'),
        weatherAdjustment: parseFloat(searchParams.get('weather') ?? '0.1'),
        direction: (parseInt(searchParams.get('direction') ?? '1')) as 1 | -1,
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'rbei') {
      const rawRecent = searchParams.get('recentResults')
      const recentResults: number[] = rawRecent ? JSON.parse(rawRecent) : [1, 1, 0]
      const result = calculateRBEI({
        marketImpliedProb: parseFloat(searchParams.get('marketProb') ?? '0.65'),
        trueTalentProb: parseFloat(searchParams.get('trueTalent') ?? '0.52'),
        performanceStdDev: parseFloat(searchParams.get('sigma') ?? '0.12'),
        recentResults,
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'ctc') {
      const result = calculateCTC({
        monthsSinceAppointment: parseInt(searchParams.get('months') ?? '14'),
        baselineTalent: parseFloat(searchParams.get('baseline') ?? '0.65'),
        rosterTurnover: parseFloat(searchParams.get('turnover') ?? '0.25'),
        newManagerEffectStrength: searchParams.get('nmEffect')
          ? parseFloat(searchParams.get('nmEffect')!)
          : undefined,
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'narrative') {
      const rawMentions = searchParams.get('mentions')
      const mentions = rawMentions
        ? JSON.parse(rawMentions)
        : [
            { sentiment: 0.8, reach: 0.9, daysAgo: 1 },
            { sentiment: 0.6, reach: 0.7, daysAgo: 2 },
            { sentiment: 0.9, reach: 0.95, daysAgo: 0 },
            { sentiment: 0.7, reach: 0.5, daysAgo: 4 },
            { sentiment: 0.5, reach: 0.3, daysAgo: 7 },
          ]
      const result = calculateNarrativeMomentum({
        mediaMentions: mentions,
        currentForm: parseFloat(searchParams.get('form') ?? '2.0'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    // ─── TIER 5: THE ABYSS ──────────────────────────────────────────────

    if (action === 'capz') {
      const result = calculateCAPZ({
        playerX: parseFloat(searchParams.get('x') ?? '0.05'),
        playerY: parseFloat(searchParams.get('y') ?? '0.5'),
        capacity: parseInt(searchParams.get('capacity') ?? '60000'),
        attendancePct: parseFloat(searchParams.get('attendance') ?? '0.95'),
        stadiumType: (searchParams.get('stadiumType') ?? 'traditional') as 'enclosed' | 'open_bowl' | 'traditional' | 'modern',
        isHome: searchParams.get('isHome') !== 'false',
        hostility: parseFloat(searchParams.get('hostility') ?? '0.7'),
        exposureSeconds: parseFloat(searchParams.get('exposure') ?? '6'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'tad') {
      const result = calculateTAD({
        currentSimilarity: parseFloat(searchParams.get('currentSim') ?? '0.65'),
        previousSimilarity: parseFloat(searchParams.get('prevSim') ?? '0.30'),
        gamesSinceOpponent: parseInt(searchParams.get('gamesSince') ?? '3'),
        leagueAverageAdaptation: searchParams.get('leagueAvg')
          ? parseFloat(searchParams.get('leagueAvg')!)
          : undefined,
        eliteThreshold: searchParams.get('eliteThresh')
          ? parseFloat(searchParams.get('eliteThresh')!)
          : undefined,
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'sub-decay') {
      const result = calculateSubDecay({
        minutesSinceSub: parseInt(searchParams.get('minutesSince') ?? '12'),
        subQuality: parseFloat(searchParams.get('subQuality') ?? '0.7'),
        opponentAdjustment: parseFloat(searchParams.get('oppAdj') ?? '0.5'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    if (action === 'ipr') {
      const result = calculateIPR({
        dramaIndex: parseFloat(searchParams.get('drama') ?? '0.8'),
        emotionalValence: (parseInt(searchParams.get('valence') ?? '1')) as 1 | -1,
        daysSincePreviousGame: parseInt(searchParams.get('days') ?? '3'),
        wasComeback: searchParams.get('comeback') === 'true',
        wasDerby: searchParams.get('derby') === 'true',
        crowdFactor: parseFloat(searchParams.get('crowd') ?? '0.8'),
      })
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    // ─── COMPOSITE: FULL ANALYSIS ───────────────────────────────────────

    if (action === 'full') {
      const rawParams = searchParams.get('params')
      if (!rawParams) {
        return NextResponse.json({
          error: 'Full analysis requires ?params=<JSON> or use POST',
          example: {
            cri: { scoreDifferential: -2, probability: 0.3, outcomeMagnitude: 0.6, minutesRemaining: 15 },
            fcd: { matchDays: [0, 3, 6] },
            mai: { teamAStakes: 0.8, teamBStakes: 0.1, gameWeight: 'high', teamAForm: 1.8, teamBForm: 1.2 },
          },
        }, { status: 400 })
      }

      const params: FullAdvancedAnalysisParams = JSON.parse(rawParams)
      const result = runFullAdvancedAnalysis(params)
      return NextResponse.json({
        compositeScore: result.compositeScore,
        compositeLabel: result.compositeLabel,
        flags: result.flags,
        formulaCount: result.formulas.length,
        formulas: result.formulas.map((f) => ({
          name: f.formula,
          tier: f.tier,
          value: f.value,
          label: f.label,
          interpretation: f.interpretation,
          confidence: f.confidence,
        })),
        timestamp: result.timestamp,
      })
    }

    // ─── UNKNOWN ACTION ─────────────────────────────────────────────────

    return NextResponse.json(
      { error: `Unknown action: "${action}"`, available: FORMULA_CATALOG.map((f) => f.action) },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, action }, { status: 500 })
  }
}

// POST for complex payloads (full analysis with all 20 params)
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`advanced-analytics:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { action, ...params } = body

    if (action === 'full') {
      const result = runFullAdvancedAnalysis(params as FullAdvancedAnalysisParams)
      return NextResponse.json(withExperimentalMetadata(result, action))
    }

    switch (action) {
      case 'cri':
        return NextResponse.json(withExperimentalMetadata(calculateCRI(params), action))
      case 'scs':
        return NextResponse.json(withExperimentalMetadata(calculateSCS(params), action))
      case 'iti':
        return NextResponse.json(withExperimentalMetadata(calculateITI(params), action))
      case 'referee-drift':
        return NextResponse.json(withExperimentalMetadata(calculateRefereeDrift(params), action))
      case 'crd':
        return NextResponse.json(withExperimentalMetadata(calculateCRD(params), action))
      case 'fcd':
        return NextResponse.json(withExperimentalMetadata(calculateFCD(params), action))
      case 'reintegration':
        return NextResponse.json(withExperimentalMetadata(calculateReintegration(params), action))
      case 'mai':
        return NextResponse.json(withExperimentalMetadata(calculateMAI(params), action))
      case 'dse':
        return NextResponse.json(withExperimentalMetadata(calculateDSE(params), action))
      case 'sbdi':
        return NextResponse.json(withExperimentalMetadata(calculateSBDI(params), action))
      case 'press-lag':
        return NextResponse.json(withExperimentalMetadata(calculatePressLag(params), action))
      case 'soa':
        return NextResponse.json(withExperimentalMetadata(calculateSOA(params), action))
      case 'line-alpha':
        return NextResponse.json(withExperimentalMetadata(calculateLineAlpha(params), action))
      case 'rbei':
        return NextResponse.json(withExperimentalMetadata(calculateRBEI(params), action))
      case 'ctc':
        return NextResponse.json(withExperimentalMetadata(calculateCTC(params), action))
      case 'narrative':
        return NextResponse.json(withExperimentalMetadata(calculateNarrativeMomentum(params), action))
      case 'capz':
        return NextResponse.json(withExperimentalMetadata(calculateCAPZ(params), action))
      case 'tad':
        return NextResponse.json(withExperimentalMetadata(calculateTAD(params), action))
      case 'sub-decay':
        return NextResponse.json(withExperimentalMetadata(calculateSubDecay(params), action))
      case 'ipr':
        return NextResponse.json(withExperimentalMetadata(calculateIPR(params), action))
      default:
        return NextResponse.json(
          { error: `Unknown POST action: "${action}"`, available: FORMULA_CATALOG.map((f) => f.action) },
          { status: 400 },
        )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}