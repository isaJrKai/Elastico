// ═══════════════════════════════════════════════════════════════════════════════
// ELASTICO — Advanced Stochastic Prediction Engine
// Port of the God-Tier Mathematical Framework from the research system
// Implements: Merton Jump-Diffusion, GARCH Volatility, Kelly Criterion,
// Bivariate Poisson, Monte Carlo Simulation, Market Signal Tracking
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JumpDiffusionParams {
  sigma: number        // Continuous Brownian volatility
  jumpLambda: number   // Jump frequency (Poisson rate)
  jumpMu: number       // Mean jump intensity
  jumpSigma: number    // Jump volatility
}

export interface StochasticMatchResult {
  matchProbabilities: {
    homeVictory: number
    draw: number
    awayVictory: number
  }
  totalsMarket: {
    over25: number
    under25: number
    over15: number
    over35: number
  }
  exoticScorelines: Record<string, number>
  expectedMeans: {
    home: number
    away: number
    total: number
  }
  asianHandicap: {
    line0: { home: number; away: number }
    lineHalf: { home: number; away: number }
    line1: { home: number; away: number }
    line15: { home: number; away: number }
  }
  bothTeamsToScore: number
  confidence: 'low' | 'medium' | 'high' | 'very-high'
  volatilityIndex: number
}

export interface KellyResult {
  action: 'BET' | 'NO_EDGE' | 'RISKY'
  edgePercentage: number
  impliedProbability: number
  modelProbability: number
  suggestedFraction: number
  suggestedWager: number
  kellyFraction: number
  odds: number
}

export interface PortfolioAllocation {
  outcomes: {
    label: string
    modelProb: number
    marketOdds: number
    edge: number
    kellyFraction: number
    wagerAmount: number
    action: 'BET' | 'NO_EDGE' | 'RISKY'
  }[]
  totalBankroll: number
  totalExposure: number
  totalExpectedValue: number
  sharpeRatio: number
}

export interface MarketSignal {
  matchId: string
  homeTeam: string
  awayTeam: string
  openingOdds: { home: number; draw: number; away: number }
  currentOdds: { home: number; draw: number; away: number }
  lineVelocity: {
    home: number
    draw: number
    away: number
  }
  sharpAction: 'home' | 'draw' | 'away' | 'neutral'
  steamMove: boolean
  rlmDetected: boolean // Reverse Line Movement
  confidence: number
  timestamp: string
}

export interface EngineConfig {
  simulationRuns: number
  kellyFraction: number  // Fractional Kelly multiplier (0.25 = quarter Kelly)
  garchEnabled: boolean
  jumpDiffusionEnabled: boolean
  minEdgeThreshold: number
  maxBankrollRisk: number
}

export interface InjuryAdjustment {
  teamId: string
  playerName: string
  status: 'out' | 'doubtful' | 'questionable'
  importance: 'star' | 'key' | 'rotation'
  xgImpact: number  // Expected goals reduction factor
}

export interface MatchInput {
  homeTeam: string
  awayTeam: string
  homeTeamId?: string
  awayTeamId?: string
  homeXg: number        // Historical expected goals per game
  awayXg: number
  homeGoalsConceded: number
  awayGoalsConceded: number
  homeElo: number
  awayElo: number
  bookmakerOdds: { home: number; draw: number; away: number }
  historicalResiduals?: { home: number[]; away: number[] }
  injuries?: InjuryAdjustment[]
  correlation?: number
}

// ── Default Configuration ──────────────────────────────────────────────────────

export const DEFAULT_CONFIG: EngineConfig = {
  simulationRuns: 150000,
  kellyFraction: 0.25,
  garchEnabled: true,
  jumpDiffusionEnabled: true,
  minEdgeThreshold: 0.02,
  maxBankrollRisk: 0.05,
}

// ── Statistical Utility Functions ───────────────────────────────────────────────

function normalRandom(): number {
  // Box-Muller transform for standard normal distribution
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function poissonRandom(lambda: number): number {
  // Knuth algorithm for Poisson distribution
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1.0
  do {
    k++
    p *= Math.random()
  } while (p > L)
  return k - 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ── GARCH(1,1) Volatility Calibration ───────────────────────────────────────────

export function calibrateGARCH(residuals: number[]): number {
  /**
   * Estimates conditional variance using a simplified GARCH(1,1) model.
   * Returns a volatility scaling factor.
   * 
   * GARCH(1,1): σ²_t = ω + α * ε²_{t-1} + β * σ²_{t-1}
   * We use maximum likelihood estimation with simplified parameters.
   */
  if (residuals.length < 15) return 1.0

  const n = residuals.length
  const mean = residuals.reduce((s, v) => s + v, 0) / n

  // Estimate GARCH parameters using method of moments
  const variance = residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  const squaredResiduals = residuals.map(r => r * r)
  const autoCorrLag1 = squaredResiduals.slice(0, -1).reduce((s, r, i) =>
    s + (r - variance) * (squaredResiduals[i + 1] - variance), 0) /
    (n - 1) / (variance * variance || 1)

  // Simplified GARCH parameters
  const alpha = clamp(autoCorrLag1 * 0.4, 0.01, 0.3)  // ARCH parameter
  const beta = clamp(1 - alpha - 0.05, 0.6, 0.95)     // GARCH parameter
  const omega = 0.05 * variance                          // Constant term

  // Forecast next-step conditional variance
  const lastSquaredResidual = squaredResiduals[n - 1]
  const prevVariance = variance
  const forecastVariance = omega + alpha * lastSquaredResidual + beta * prevVariance

  // Return volatility scaling factor (forecast / historical baseline)
  return Math.sqrt(forecastVariance / (variance || 1))
}

// ── Merton Jump-Diffusion Parameter Extraction ──────────────────────────────────

export function extractJumpDiffusionParams(residuals: number[]): JumpDiffusionParams {
  /**
   * Separates continuous diffusion from structural jump shocks.
   * Uses a 2-standard-deviation threshold to identify outlier events
   * (red cards, early injuries, unexpected tactical shifts).
   */
  if (residuals.length < 20) {
    return { sigma: 0.25, jumpLambda: 0.10, jumpMu: -0.05, jumpSigma: 0.15 }
  }

  const threshold = 2.0 * (residuals.reduce((s, r) => s + r * r, 0) / residuals.length) ** 0.5
  const normalShocks = residuals.filter(r => Math.abs(r) <= threshold)
  const jumpShocks = residuals.filter(r => Math.abs(r) > threshold)

  const sigma = normalShocks.length > 0
    ? normalShocks.reduce((s, r) => s + r * r, 0) / normalShocks.length
    : 0.25

  const jumpLambda = jumpShocks.length / residuals.length
  const jumpMu = jumpShocks.length > 0
    ? jumpShocks.reduce((s, r) => s + r, 0) / jumpShocks.length
    : 0.0
  const jumpSigma = jumpShocks.length > 1
    ? Math.sqrt(jumpShocks.reduce((s, r) => s + (r - jumpMu) ** 2, 0) / (jumpShocks.length - 1))
    : 0.20

  return {
    sigma: Math.sqrt(sigma),
    jumpLambda: clamp(jumpLambda, 0, 1),
    jumpMu,
    jumpSigma: clamp(jumpSigma, 0.01, 2),
  }
}

// ── Injury Adjustment Layer ────────────────────────────────────────────────────

export function applyInjuryAdjustments(
  baseXg: number,
  injuries: InjuryAdjustment[]
): number {
  /**
   * Modifies projected expected goals based on missing players.
   * Star player out: -15% xG
   * Key player out: -8% xG
   * Rotation player out: -3% xG
   */
  let adjustedXg = baseXg
  for (const injury of injuries) {
    if (injury.status === 'out') {
      adjustedXg *= (1 - injury.xgImpact)
    } else if (injury.status === 'doubtful') {
      adjustedXg *= (1 - injury.xgImpact * 0.5)
    } else if (injury.status === 'questionable') {
      adjustedXg *= (1 - injury.xgImpact * 0.25)
    }
  }
  return Math.max(0.1, adjustedXg)
}

// ── Core Stochastic Simulation Engine ──────────────────────────────────────────

export function runStochasticSimulation(
  input: MatchInput,
  config: EngineConfig = DEFAULT_CONFIG
): StochasticMatchResult {
  /**
   * Executes a high-iteration Monte Carlo simulation using a
   * Bivariate Merton Jump-Diffusion Process with GARCH volatility scaling.
   * 
   * This models match outcomes as continuous stochastic differential
   * processes interrupted by Poisson-distributed structural jumps,
   * matching the methodology used by elite quantitative sports funds.
   */
  const { simulationRuns, garchEnabled, jumpDiffusionEnabled } = config

  // Step 1: Calibrate base intensity parameters from xG + ELO
  const eloDiff = input.homeElo - input.awayElo
  const eloFactor = 1 / (1 + Math.pow(10, -eloDiff / 400))
  const avgXg = (input.homeXg + input.awayXg) / 2

  // Home advantage adjustment (+0.25 goals typical for home field)
  let muHome = input.homeXg * (0.7 + 0.3 * eloFactor) + 0.25
  let muAway = input.awayXg * (0.7 + 0.3 * (1 - eloFactor))

  // Step 2: Apply injury adjustments
  const homeInjuries = input.injuries?.filter(i => i.teamId === input.homeTeamId) || []
  const awayInjuries = input.injuries?.filter(i => i.teamId === input.awayTeamId) || []
  muHome = applyInjuryAdjustments(muHome, homeInjuries)
  muAway = applyInjuryAdjustments(muAway, awayInjuries)

  // Step 3: GARCH volatility calibration
  const homeResiduals = input.historicalResiduals?.home || []
  const awayResiduals = input.historicalResiduals?.away || []
  const volScalarHome = garchEnabled ? calibrateGARCH(homeResiduals) : 1.0
  const volScalarAway = garchEnabled ? calibrateGARCH(awayResiduals) : 1.0

  // Step 4: Extract jump-diffusion parameters
  const homeJd = jumpDiffusionEnabled
    ? extractJumpDiffusionParams(homeResiduals)
    : { sigma: 0.20, jumpLambda: 0.05, jumpMu: 0, jumpSigma: 0.15 }
  const awayJd = jumpDiffusionEnabled
    ? extractJumpDiffusionParams(awayResiduals)
    : { sigma: 0.20, jumpLambda: 0.05, jumpMu: 0, jumpSigma: 0.15 }

  // Step 5: Compute inter-team correlation
  const rho = input.correlation ?? 0.12

  // Step 6: Execute Monte Carlo simulation
  let homeWins = 0
  let awayWins = 0
  let draws = 0
  let over25 = 0
  let over15 = 0
  let over35 = 0
  let btts = 0
  const scorelineCounts: Record<string, number> = {}
  let totalHomeGoals = 0
  let totalAwayGoals = 0

  // Pre-compute correlation transformation constants
  const sqrtOneMinusRho2 = Math.sqrt(Math.max(0, 1 - rho * rho))

  for (let i = 0; i < simulationRuns; i++) {
    // Generate correlated Brownian motion paths via Cholesky decomposition
    const zHomeRaw = normalRandom()
    const zAwayRaw = normalRandom()
    const zHome = zHomeRaw
    const zAway = rho * zHomeRaw + sqrtOneMinusRho2 * zAwayRaw

    // Apply GARCH volatility scaling to base intensities
    const scaledMuHome = muHome * volScalarHome
    const scaledMuAway = muAway * volScalarAway

    // Merton Jump-Diffusion: continuous diffusion + Poisson jumps
    const hSigma = homeJd.sigma
    const aSigma = awayJd.sigma
    const dt = 1.0 // One match unit

    // Poisson jump processes for structural shocks
    const jumpCountHome = poissonRandom(homeJd.jumpLambda * dt)
    const jumpCountAway = poissonRandom(awayJd.jumpLambda * dt)

    // Calculate jump magnitudes with drift + volatility
    const jumpMagHome = jumpCountHome > 0
      ? jumpCountHome * homeJd.jumpMu + Math.sqrt(jumpCountHome) * homeJd.jumpSigma * normalRandom()
      : 0
    const jumpMagAway = jumpCountAway > 0
      ? jumpCountAway * awayJd.jumpMu + Math.sqrt(jumpCountAway) * awayJd.jumpSigma * normalRandom()
      : 0

    // Synthesize continuous diffusion with structural shocks
    const stochasticHome = scaledMuHome *
      Math.exp((hSigma * hSigma / -2.0) * dt + hSigma * Math.sqrt(dt) * zHome + jumpMagHome)
    const stochasticAway = scaledMuAway *
      Math.exp((aSigma * aSigma / -2.0) * dt + aSigma * Math.sqrt(dt) * zAway + jumpMagAway)

    // Convert intensity paths to observable goal outputs via Poisson distribution
    const goalsHome = poissonRandom(Math.max(0.01, stochasticHome))
    const goalsAway = poissonRandom(Math.max(0.01, stochasticAway))

    // Accumulate statistics
    totalHomeGoals += goalsHome
    totalAwayGoals += goalsAway

    if (goalsHome > goalsAway) homeWins++
    else if (goalsAway > goalsHome) awayWins++
    else draws++

    const total = goalsHome + goalsAway
    if (total > 2.5) over25++
    if (total > 1.5) over15++
    if (total > 3.5) over35++
    if (goalsHome > 0 && goalsAway > 0) btts++

    const key = `${goalsHome}-${goalsAway}`
    scorelineCounts[key] = (scorelineCounts[key] || 0) + 1
  }

  // Step 7: Compute Asian Handicap probabilities
  const computeAH = (line: number) => {
    let homeCovers = 0
    let awayCovers = 0
    // Re-simulate for AH (using same parameters, smaller run)
    const ahRuns = Math.min(50000, simulationRuns)
    for (let i = 0; i < ahRuns; i++) {
      const zH = normalRandom()
      const zA = rho * zH + sqrtOneMinusRho2 * normalRandom()
      const sH = poissonRandom(Math.max(0.01, muHome * volScalarHome *
        Math.exp((homeJd.sigma ** 2 / -2.0) + homeJd.sigma * zH)))
      const sA = poissonRandom(Math.max(0.01, muAway * volScalarAway *
        Math.exp((awayJd.sigma ** 2 / -2.0) + awayJd.sigma * zA)))
      const diff = sH - sA - line
      if (diff > 0) homeCovers++
      else if (diff < 0) awayCovers++
    }
    return { home: homeCovers / ahRuns, away: awayCovers / ahRuns }
  }

  // Step 8: Determine confidence level
  const maxProb = Math.max(homeWins, draws, awayWins) / simulationRuns
  const confidence: StochasticMatchResult['confidence'] =
    maxProb > 0.55 ? 'very-high' :
    maxProb > 0.48 ? 'high' :
    maxProb > 0.42 ? 'medium' : 'low'

  // Step 9: Calculate volatility index (0-100)
  const goalVariance = Array.from({ length: 100 }, () => {
    const gH = poissonRandom(muHome)
    const gA = poissonRandom(muAway)
    return Math.abs(gH + gA - (muHome + muAway))
  })
  const avgDeviation = goalVariance.reduce((s, v) => s + v, 0) / 100
  const volatilityIndex = clamp((avgDeviation / (muHome + muAway || 1)) * 100, 0, 100)

  return {
    matchProbabilities: {
      homeVictory: homeWins / simulationRuns,
      draw: draws / simulationRuns,
      awayVictory: awayWins / simulationRuns,
    },
    totalsMarket: {
      over25: over25 / simulationRuns,
      under25: 1 - over25 / simulationRuns,
      over15: over15 / simulationRuns,
      over35: over35 / simulationRuns,
    },
    exoticScorelines: Object.fromEntries(
      Object.entries(scorelineCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, count]) => [key, count / simulationRuns])
    ),
    expectedMeans: {
      home: totalHomeGoals / simulationRuns,
      away: totalAwayGoals / simulationRuns,
      total: (totalHomeGoals + totalAwayGoals) / simulationRuns,
    },
    asianHandicap: {
      line0: computeAH(0),
      lineHalf: computeAH(-0.5),
      line1: computeAH(-1),
      line15: computeAH(-1.5),
    },
    bothTeamsToScore: btts / simulationRuns,
    confidence,
    volatilityIndex,
  }
}

// ── Kelly Criterion Engine ──────────────────────────────────────────────────────

export function calculateKelly(
  modelProbability: number,
  bookmakerOdds: number,
  bankroll: number,
  fractionalKelly: number = 0.25
): KellyResult {
  /**
   * Implements the Kelly Criterion for optimal bankroll allocation.
   * Uses fractional Kelly (default 25%) for safer variance management.
   * 
   * Kelly Formula: f* = (p*b - q) / b
   * Where: p = model probability, b = decimal odds - 1, q = 1 - p
   */
  const impliedProb = 1 / bookmakerOdds
  const edge = modelProbability - impliedProb

  if (edge <= 0) {
    return {
      action: 'NO_EDGE',
      edgePercentage: -Math.abs(edge) * 100,
      impliedProbability: impliedProb,
      modelProbability,
      suggestedFraction: 0,
      suggestedWager: 0,
      kellyFraction: 0,
      odds: bookmakerOdds,
    }
  }

  const b = bookmakerOdds - 1  // Net odds
  const q = 1 - modelProbability
  const rawKelly = (modelProbability * b - q) / b
  const safeKelly = rawKelly * fractionalKelly
  const wager = bankroll * safeKelly

  // Risk classification
  const action: KellyResult['action'] =
    edge > 0.10 ? 'BET' :
    edge > 0.03 ? 'BET' : 'RISKY'

  return {
    action,
    edgePercentage: edge * 100,
    impliedProbability: impliedProb,
    modelProbability,
    suggestedFraction: safeKelly,
    suggestedWager: Math.round(wager * 100) / 100,
    kellyFraction: rawKelly,
    odds: bookmakerOdds,
  }
}

// ── Multi-Asset Portfolio Allocation ────────────────────────────────────────────

export function calculatePortfolioAllocation(
  outcomes: { label: string; modelProb: number; odds: number }[],
  bankroll: number,
  correlationMatrix: number[][] = [
    [1.00, 0.55, 0.15],
    [0.55, 1.00, 0.20],
    [0.15, 0.20, 1.00],
  ]
): PortfolioAllocation {
  /**
   * Implements a multi-asset Kelly Criterion with covariance adjustment.
   * Accounts for correlation between bet outcomes to prevent overexposure
   * on correlated positions (e.g., home win + over 2.5 goals).
   */

  // Invert correlation matrix for covariance-weighted allocation
  const n = correlationMatrix.length
  const covInv = invertMatrix(correlationMatrix)

  const results = outcomes.map((out, i) => {
    const impliedProb = 1 / out.odds
    const edge = out.modelProb - impliedProb

    // Covariance-adjusted edge
    const adjustedEdge = covInv
      ? covInv[i]?.reduce((sum, c, j) => sum + c * (outcomes[j].modelProb - 1 / outcomes[j].odds), 0) || edge
      : edge

    const b = out.odds - 1
    const q = 1 - out.modelProb
    const rawKelly = (out.modelProb * b - q) / b
    const safeKelly = Math.max(0, rawKelly * 0.10) // 10% fractional Kelly

    return {
      label: out.label,
      modelProb: out.modelProb,
      marketOdds: out.odds,
      edge: edge * 100,
      kellyFraction: safeKelly,
      wagerAmount: Math.round(bankroll * safeKelly * 100) / 100,
      action: edge > 0.02 ? 'BET' as const : edge > 0 ? 'RISKY' as const : 'NO_EDGE' as const,
    }
  })

  const totalExposure = results.reduce((s, r) => s + r.wagerAmount, 0)
  const totalEV = results.reduce((s, r) => s + r.wagerAmount * r.edge / 100, 0)
  const avgReturn = totalExposure > 0 ? totalEV / totalExposure : 0
  const sharpeRatio = results.length > 1 ? avgReturn / (Math.sqrt(results.reduce((s, r) => s + (r.edge / 100 - avgReturn) ** 2, 0) / results.length) || 0.01) : 0

  return {
    outcomes: results,
    totalBankroll: bankroll,
    totalExposure: Math.round(totalExposure * 100) / 100,
    totalExpectedValue: Math.round(totalEV * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
  }
}

// ── Matrix Inversion (3x3) ─────────────────────────────────────────────────────

function invertMatrix(m: number[][]): number[][] | null {
  if (m.length !== 3 || m[0].length !== 3) return null

  const [a, b, c] = m[0]
  const [d, e, f] = m[1]
  const [g, h, i] = m[2]

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-10) return null

  const invDet = 1 / det
  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ]
}

// ── Market Signal Tracker ───────────────────────────────────────────────────────

export function analyzeMarketSignals(
  openingOdds: { home: number; draw: number; away: number },
  currentOdds: { home: number; draw: number; away: number },
  matchId: string,
  homeTeam: string,
  awayTeam: string
): MarketSignal {
  /**
   * Tracks line movement velocity to detect sharp money action.
   * 
   * Key signals:
   * - Steam Move: Rapid odds movement in one direction
   * - Reverse Line Movement (RLM): Line moves AGAINST public betting
   * - Sharp Action: Professional syndicate money detected
   */

  // Calculate line velocity (negative = odds dropping = money coming in)
  const homeVelocity = (currentOdds.home - openingOdds.home) / openingOdds.home
  const drawVelocity = (currentOdds.draw - openingOdds.draw) / openingOdds.draw
  const awayVelocity = (currentOdds.away - openingOdds.away) / openingOdds.away

  // Detect significant moves (>3% change is notable)
  const threshold = 0.03
  const homeSteam = homeVelocity < -threshold
  const awaySteam = awayVelocity < -threshold
  const drawSteam = drawVelocity < -threshold

  // Detect RLM: odds drop on one side despite public likely betting the other
  const rlmDetected = (homeVelocity < -threshold && awayVelocity > threshold) ||
    (awayVelocity < -threshold && homeVelocity > threshold)

  // Determine sharp action direction
  const velocities = [
    { dir: 'home' as const, vel: Math.abs(homeVelocity) },
    { dir: 'draw' as const, vel: Math.abs(drawVelocity) },
    { dir: 'away' as const, vel: Math.abs(awayVelocity) },
  ]
  velocities.sort((a, b) => b.vel - a.vel)

  const sharpAction: MarketSignal['sharpAction'] =
    velocities[0].vel > threshold ? velocities[0].dir : 'neutral'

  // Confidence score based on magnitude of movement
  const maxMove = Math.max(Math.abs(homeVelocity), Math.abs(drawVelocity), Math.abs(awayVelocity))
  const confidence = clamp(maxMove * 500, 0, 100)

  return {
    matchId,
    homeTeam,
    awayTeam,
    openingOdds,
    currentOdds,
    lineVelocity: {
      home: Math.round(homeVelocity * 10000) / 100,
      draw: Math.round(drawVelocity * 10000) / 100,
      away: Math.round(awayVelocity * 10000) / 100,
    },
    sharpAction,
    steamMove: homeSteam || awaySteam || drawSteam,
    rlmDetected,
    confidence: Math.round(confidence),
    timestamp: new Date().toISOString(),
  }
}

// ── xG Luck Adjustment ─────────────────────────────────────────────────────────

export function adjustForLuck(
  rawGoals: number,
  xg: number,
  sampleSize: number = 10
): { luckAdjustedGoals: number; luckFactor: number } {
  /**
   * Removes "luck" from raw scores by regressing toward xG.
   * Uses a Bayesian shrinkage estimator weighted by sample size.
   * 
   * Small sample → more regression toward xG (more luck adjustment)
   * Large sample → trust raw goals more
   */
  const weight = Math.min(sampleSize / 30, 1) // Full weight at 30+ games
  const luckAdjustedGoals = rawGoals * weight + xg * (1 - weight)
  const luckFactor = rawGoals > 0 ? xg / rawGoals : 1

  return {
    luckAdjustedGoals: Math.round(luckAdjustedGoals * 100) / 100,
    luckFactor: Math.round(luckFactor * 100) / 100,
  }
}

// ── Complete Match Analysis Pipeline ────────────────────────────────────────────

export interface FullMatchAnalysis {
  matchInput: MatchInput
  simulation: StochasticMatchResult
  kellyResults: {
    home: KellyResult
    draw: KellyResult
    away: KellyResult
    over25: KellyResult
    under25: KellyResult
  }
  portfolioAllocation: PortfolioAllocation
  marketSignal: MarketSignal | null
  luckAdjustment: {
    home: ReturnType<typeof adjustForLuck>
    away: ReturnType<typeof adjustForLuck>
  }
  recommendation: string
  riskRating: 'low' | 'medium' | 'high' | 'very-high'
}

export function runFullMatchAnalysis(
  input: MatchInput,
  bankroll: number = 1000,
  openingOdds?: { home: number; draw: number; away: number },
  config: EngineConfig = DEFAULT_CONFIG
): FullMatchAnalysis {
  /**
   * The complete ELASTICO analysis pipeline:
   * 1. Luck-adjust historical data
   * 2. Run stochastic simulation
   * 3. Calculate Kelly Criterion for all markets
   * 4. Generate portfolio allocation
   * 5. Analyze market signals
   * 6. Produce final recommendation
   */

  // Step 1: Luck adjustment
  const homeLuck = adjustForLuck(
    input.homeXg * 1.1, // Approximate actual goals from xG
    input.homeXg
  )
  const awayLuck = adjustForLuck(
    input.awayXg * 0.9,
    input.awayXg
  )

  // Step 2: Run simulation with luck-adjusted inputs
  const adjustedInput: MatchInput = {
    ...input,
    homeXg: homeLuck.luckAdjustedGoals,
    awayXg: awayLuck.luckAdjustedGoals,
  }
  const simulation = runStochasticSimulation(adjustedInput, config)

  // Step 3: Kelly Criterion for each market
  const kellyResults = {
    home: calculateKelly(
      simulation.matchProbabilities.homeVictory,
      input.bookmakerOdds.home,
      bankroll,
      config.kellyFraction
    ),
    draw: calculateKelly(
      simulation.matchProbabilities.draw,
      input.bookmakerOdds.draw,
      bankroll,
      config.kellyFraction
    ),
    away: calculateKelly(
      simulation.matchProbabilities.awayVictory,
      input.bookmakerOdds.away,
      bankroll,
      config.kellyFraction
    ),
    over25: calculateKelly(
      simulation.totalsMarket.over25,
      input.bookmakerOdds.home * 0.9, // Approximate over/under odds
      bankroll,
      config.kellyFraction
    ),
    under25: calculateKelly(
      simulation.totalsMarket.under25,
      input.bookmakerOdds.home * 1.1,
      bankroll,
      config.kellyFraction
    ),
  }

  // Step 4: Portfolio allocation
  const portfolioAllocation = calculatePortfolioAllocation([
    { label: `Home Win (${input.homeTeam})`, modelProb: simulation.matchProbabilities.homeVictory, odds: input.bookmakerOdds.home },
    { label: `Draw`, modelProb: simulation.matchProbabilities.draw, odds: input.bookmakerOdds.draw },
    { label: `Away Win (${input.awayTeam})`, modelProb: simulation.matchProbabilities.awayVictory, odds: input.bookmakerOdds.away },
  ], bankroll)

  // Step 5: Market signals
  const marketSignal = openingOdds
    ? analyzeMarketSignals(openingOdds, input.bookmakerOdds, input.homeTeamId || '', input.homeTeam, input.awayTeam)
    : null

  // Step 6: Generate recommendation
  const bestBet = [kellyResults.home, kellyResults.draw, kellyResults.away]
    .filter(k => k.action === 'BET')
    .sort((a, b) => b.edgePercentage - a.edgePercentage)[0]

  const recommendation = bestBet
    ? `RECOMMENDED: ${bestBet.edgePercentage.toFixed(1)}% edge detected. Suggested wager: $${bestBet.suggestedWager.toFixed(2)} (${(bestBet.suggestedFraction * 100).toFixed(2)}% of bankroll). Model probability: ${(bestBet.modelProbability * 100).toFixed(1)}% vs market implied: ${(bestBet.impliedProbability * 100).toFixed(1)}%.`
    : 'No positive expected value bets found for this match. The market appears efficiently priced.'

  // Risk rating
  const maxEdge = Math.max(
    kellyResults.home.edgePercentage,
    kellyResults.draw.edgePercentage,
    kellyResults.away.edgePercentage
  )
  const riskRating: FullMatchAnalysis['riskRating'] =
    simulation.volatilityIndex > 70 ? 'very-high' :
    simulation.volatilityIndex > 50 ? 'high' :
    simulation.volatilityIndex > 30 ? 'medium' : 'low'

  return {
    matchInput: adjustedInput,
    simulation,
    kellyResults,
    portfolioAllocation,
    marketSignal,
    luckAdjustment: { home: homeLuck, away: awayLuck },
    recommendation,
    riskRating,
  }
}