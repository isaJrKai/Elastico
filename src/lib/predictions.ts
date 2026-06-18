// ============================================================================
// ELASTICO — Football (Soccer) Prediction Engine
// Pure-math, zero-dependency prediction & analytics library
// ============================================================================

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Result of an ELO calculation. */
export interface EloResult {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  homeEloNew: number;
  awayEloNew: number;
}

/** Full Poisson probability matrix plus aggregated stats. */
export interface PoissonResult {
  matrix: number[][];
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  overProb: number;
  underProb: number;
  bttsProb: number;
  mostLikelyScore: { home: number; away: number };
}

/** Dixon-Coles model output. */
export interface DixonColesResult {
  matrix: number[][];
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  rawHomeWinProb: number;
  rawDrawProb: number;
  rawAwayWinProb: number;
}

/** Single Monte Carlo simulation outcome. */
export interface SimulationOutcome {
  homeGoals: number;
  awayGoals: number;
  result: 'home' | 'draw' | 'away';
}

/** Aggregated Monte Carlo statistics. */
export interface MonteCarloStats {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  goalDistribution: { home: number[]; away: number[] };
  scoreDistribution: Map<string, number>;
}

/** Full Monte Carlo simulation result. */
export interface MonteCarloResult {
  simulations: SimulationOutcome[];
  stats: MonteCarloStats;
}

/** Wilson score confidence interval. */
export interface WilsonInterval {
  lower: number;
  upper: number;
  center: number;
}

/** Shot descriptor for xG calculation. */
export interface Shot {
  x: number;       // normalised x position (0 = own goal line, 1 = opponent goal line)
  y: number;       // normalised y position (0 = left, 1 = right)
  type?: 'open_play' | 'penalty' | 'free_kick' | 'header';
  bodyPart?: 'foot' | 'head' | 'other';
}

/** xG calculation result. */
export interface XgResult {
  total: number;
  shotXgs: number[];
}

/** Form calculation result. */
export interface FormResult {
  formRating: number;   // -1 to 1  (1 = perfect W streak, -1 = all losses)
  momentum: number;     // 0-100
  trend: 'improving' | 'declining' | 'stable';
}

/** Team object used for comparisons. */
export interface TeamData {
  name: string;
  elo: number;
  form: string[];           // recent results, e.g. ['W','D','L','W','W']
  attackStrength: number;   // > 1 = above average
  defenseStrength: number;  // < 1 = better than average
  avgGoalsScored: number;
  avgGoalsConceded: number;
  style?: 'possession' | 'counter_attack' | 'direct' | 'defensive' | 'balanced';
}

/** Comprehensive team comparison output. */
export interface TeamComparisonResult {
  eloGap: number;
  eloAdvantage: 'home' | 'away' | 'even';
  formComparison: {
    home: FormResult;
    away: FormResult;
    advantage: 'home' | 'away' | 'even';
  };
  styleClashRating: number;  // 0-100 how tactically interesting the matchup is
  headToHeadAdvice: string;
}

/** First-half event for halftime adjustment. */
export interface FirstHalfEvent {
  minute: number;
  type: 'goal' | 'red_card' | 'yellow_card' | 'substitution' | 'injury';
  team: 'home' | 'away';
  detail?: string;
}

/** Halftime adjustment output. */
export interface HalftimeAdjustmentResult {
  homeGoalAdjustment: number;    // delta to expected home goals
  awayGoalAdjustment: number;    // delta to expected away goals
  homeWinProbAdjustment: number; // percentage point shift
  drawProbAdjustment: number;
  awayWinProbAdjustment: number;
  narrative: string;
}

/** Match data for tactical insight generation. */
export interface MatchStats {
  homePossession: number;       // 0-100
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homePassAccuracy: number;     // 0-100
  awayPassAccuracy: number;
  homeXg?: number;
  awayXg?: number;
}

/** Momentum data point on the timeline. */
export interface MomentumPoint {
  minute: number;
  homeMomentum: number;   // -100 to 100 (positive = home-favoured)
  awayMomentum: number;   // -100 to 100 (positive = away-favoured)
}

/** Match event for momentum calculation. */
export interface MatchEvent {
  minute: number;
  type:
    | 'goal'
    | 'red_card'
    | 'yellow_card'
    | 'shot_on_target'
    | 'shot_off_target'
    | 'corner'
    | 'dangerous_attack'
    | 'substitution';
  team: 'home' | 'away';
  impact?: number; // optional custom impact override
}

/** Weather impact result. */
export interface WeatherImpactResult {
  goalModifier: number;  // multiplicative factor on expected goals
  narrative: string;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Natural log of factorial (via log-gamma identity). */
function lnFactorial(n: number): number {
  if (n <= 1) return 0;
  return lnGamma(n + 1);
}

/** Stirling approximation + Lanczos for ln(Gamma(z)). */
function lnGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  // Lanczos approximation (g=7, n=9)
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  const x = c[0];
  const t = z + g - 0.5;
  let sum = x;
  for (let i = 1; i < c.length; i++) {
    sum += c[i] / (z + i - 1);
  }
  return 0.5 * Math.log(2 * Math.PI) + (z - 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Poisson probability P(X=k) for a given lambda. */
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - lnFactorial(k));
}

/** Standard logistic CDF. */
function logisticCdf(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Dixon-Coles tau adjustment for correlated low-scoring outcomes. */
function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  homeLambda: number,
  awayLambda: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - homeLambda * awayLambda * rho;
  }
  if (homeGoals === 0 && awayGoals === 1) {
    return 1 + homeLambda * rho;
  }
  if (homeGoals === 1 && awayGoals === 0) {
    return 1 + awayLambda * rho;
  }
  if (homeGoals === 1 && awayGoals === 1) {
    return 1 - rho;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// 1. ELO Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate match probabilities and post-match ELO ratings.
 *
 * Uses the standard logistic ELO formula with a configurable home-advantage
 * bonus (in ELO points).  Draw probability is estimated via a normal
 * approximation around the ELO gap.  Expected goals are linearly mapped
 * from the expected score.
 *
 * @param homeElo  Home team's current ELO rating.
 * @param awayElo  Away team's current ELO rating.
 * @param K        K-factor for ELO updates (default 40).
 * @param homeAdvantage  Home advantage in ELO points (default 65).
 */
export function calculateElo(
  homeElo: number,
  awayElo: number,
  K: number = 40,
  homeAdvantage: number = 65,
): EloResult {
  const eloDiff = homeElo + homeAdvantage - awayElo;

  // Expected score (logistic): E ∈ (0, 1)
  const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const expectedAway = 1 - expectedHome;

  // Draw probability: model the draw as a narrow band around rating parity.
  // Using a normal approximation with σ ≈ 200 ELO points.
  const sigma = 200;
  const drawWidth = 40; // half-width of the draw band in ELO points
  const z1 = (eloDiff - drawWidth) / sigma;
  const z2 = (eloDiff + drawWidth) / sigma;
  const normalCDF = (z: number): number => 0.5 * (1 + erfApprox(z / Math.SQRT2));
  const rawDraw = normalCDF(z2) - normalCDF(z1);

  // Scale: ensure drawProb is reasonable (cap between 0.15 and 0.35)
  const drawProb = clamp(rawDraw, 0.15, 0.35);

  // Distribute remaining probability proportionally
  const remaining = 1 - drawProb;
  const homeRaw = expectedHome / (expectedHome + expectedAway);
  const homeProb = remaining * homeRaw;
  const awayProb = remaining * (1 - homeRaw);

  // Expected goals: league-average ≈ 1.35 goals per team per match.
  // Map ELO expected score linearly.
  const leagueAvgGoals = 1.35;
  const expectedHomeGoals = clamp(
    leagueAvgGoals * (expectedHome / 0.5),
    0.4,
    3.5,
  );
  const expectedAwayGoals = clamp(
    leagueAvgGoals * (expectedAway / 0.5),
    0.4,
    3.5,
  );

  // Assume a home win for demonstration of new ratings
  const homeEloNew = Math.round(
    homeElo + K * (1 - expectedHome),
  );
  const awayEloNew = Math.round(
    awayElo + K * (0 - expectedAway),
  );

  return {
    homeProb,
    drawProb,
    awayProb,
    expectedHomeGoals,
    expectedAwayGoals,
    homeEloNew,
    awayEloNew,
  };
}

/** Error function approximation (Abramowitz & Stegun). */
function erfApprox(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

// ---------------------------------------------------------------------------
// 2. Poisson Probabilities
// ---------------------------------------------------------------------------

/**
 * Build a full Poisson probability matrix for a match and derive
 * aggregate statistics (1X2, O/U 2.5, BTTS, most likely score).
 *
 * @param homeExpected  Expected goals for the home team.
 * @param awayExpected  Expected goals for the away team.
 * @param maxGoals      Maximum number of goals to model per team (default 8).
 */
export function poissonProbabilities(
  homeExpected: number,
  awayExpected: number,
  maxGoals: number = 8,
): PoissonResult {
  // Build probability matrix
  const matrix: number[][] = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] =
        poissonPmf(h, homeExpected) * poissonPmf(a, awayExpected);
    }
  }

  // Aggregate stats
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  let overProb = 0;
  let bttsProb = 0;
  let maxProb = 0;
  let mostLikelyScore = { home: 0, away: 0 };

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      if (h > a) homeWinProb += p;
      else if (h === a) drawProb += p;
      else awayWinProb += p;

      if (h + a > 2) overProb += p;
      if (h > 0 && a > 0) bttsProb += p;

      if (p > maxProb) {
        maxProb = p;
        mostLikelyScore = { home: h, away: a };
      }
    }
  }

  return {
    matrix,
    homeWinProb,
    drawProb,
    awayWinProb,
    overProb,
    underProb: 1 - overProb,
    bttsProb,
    mostLikelyScore,
  };
}

// ---------------------------------------------------------------------------
// 3. Dixon-Coles Model
// ---------------------------------------------------------------------------

/**
 * Calculate adjusted match probabilities using the Dixon-Coles model.
 *
 * The Dixon-Coles model modifies the independent Poisson probabilities
 * for low-scoring outcomes (0-0, 1-0, 0-1, 1-1) to account for the
 * observed negative correlation between home and away goals.
 *
 * @param homeGoals    Home goals to model up to.
 * @param awayGoals    Away goals to model up to.
 * @param homeAttack   Home team attack strength (> 1 = above avg).
 * @param homeDefense  Home team defense strength (< 1 = better).
 * @param awayAttack   Away team attack strength (> 1 = above avg).
 * @param awayDefense  Away team defense strength (< 1 = better).
 * @param homeAdv      Home advantage multiplier (default 0.3).
 * @param rho          Dixon-Coles correlation parameter (default -0.13).
 */
export function dixonColes(
  homeGoals: number = 8,
  awayGoals: number = 8,
  homeAttack: number,
  homeDefense: number,
  awayAttack: number,
  awayDefense: number,
  homeAdv: number = 0.3,
  rho: number = -0.13,
): DixonColesResult {
  // Baseline average goals
  const baseHome = 1.35;
  const baseAway = 1.15;

  // Expected goals incorporating strengths and home advantage
  const homeLambda = baseHome * homeAttack * awayDefense * homeAdv;
  const awayLambda = baseAway * awayAttack * homeDefense;

  // Build raw Poisson matrix
  const rawMatrix: number[][] = [];
  const adjMatrix: number[][] = [];

  for (let h = 0; h <= homeGoals; h++) {
    rawMatrix[h] = [];
    adjMatrix[h] = [];
    for (let a = 0; a <= awayGoals; a++) {
      const raw = poissonPmf(h, homeLambda) * poissonPmf(a, awayLambda);
      const tau = dixonColesTau(h, a, homeLambda, awayLambda, rho);
      rawMatrix[h][a] = raw;
      adjMatrix[h][a] = raw * tau;
    }
  }

  // Normalise adjusted matrix
  let totalAdj = 0;
  for (let h = 0; h <= homeGoals; h++) {
    for (let a = 0; a <= awayGoals; a++) {
      totalAdj += adjMatrix[h][a];
    }
  }
  for (let h = 0; h <= homeGoals; h++) {
    for (let a = 0; a <= awayGoals; a++) {
      adjMatrix[h][a] /= totalAdj;
    }
  }

  // Raw (unadjusted) stats
  let rawHomeWin = 0;
  let rawDraw = 0;
  let rawAwayWin = 0;
  let adjHomeWin = 0;
  let adjDraw = 0;
  let adjAwayWin = 0;

  for (let h = 0; h <= homeGoals; h++) {
    for (let a = 0; a <= awayGoals; a++) {
      if (h > a) {
        rawHomeWin += rawMatrix[h][a];
        adjHomeWin += adjMatrix[h][a];
      } else if (h === a) {
        rawDraw += rawMatrix[h][a];
        adjDraw += adjMatrix[h][a];
      } else {
        rawAwayWin += rawMatrix[h][a];
        adjAwayWin += adjMatrix[h][a];
      }
    }
  }

  return {
    matrix: adjMatrix,
    homeWinProb: adjHomeWin,
    drawProb: adjDraw,
    awayWinProb: adjAwayWin,
    rawHomeWinProb: rawHomeWin,
    rawDrawProb: rawDraw,
    rawAwayWinProb: rawAwayWin,
  };
}

// ---------------------------------------------------------------------------
// 4. Monte Carlo Simulation
// ---------------------------------------------------------------------------

/**
 * Run Monte Carlo simulations of a match to generate probabilistic forecasts.
 *
 * Each iteration draws home and away goals from Poisson distributions
 * parameterised by ELO-derived expected goals.
 *
 * @param homeElo       Home team ELO rating.
 * @param awayElo       Away team ELO rating.
 * @param homeAdvantage Home advantage in ELO points (default 65).
 * @param iterations    Number of simulations (default 2000).
 */
export function monteCarloSimulation(
  homeElo: number,
  awayElo: number,
  homeAdvantage: number = 65,
  iterations: number = 2000,
): MonteCarloResult {
  const elo = calculateElo(homeElo, awayElo, 40, homeAdvantage);
  const homeLambda = elo.expectedHomeGoals;
  const awayLambda = elo.expectedAwayGoals;

  const simulations: SimulationOutcome[] = [];
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;

  // Goal distributions (index = goals scored, value = count)
  const homeGoalDist = new Array(10).fill(0);
  const awayGoalDist = new Array(10).fill(0);
  const scoreDist = new Map<string, number>();

  for (let i = 0; i < iterations; i++) {
    const h = samplePoisson(homeLambda);
    const a = samplePoisson(awayLambda);

    const result: 'home' | 'draw' | 'away' =
      h > a ? 'home' : h === a ? 'draw' : 'away';

    simulations.push({ homeGoals: h, awayGoals: a, result });

    if (result === 'home') homeWins++;
    else if (result === 'draw') draws++;
    else awayWins++;

    totalHomeGoals += h;
    totalAwayGoals += a;

    if (h < homeGoalDist.length) homeGoalDist[h]++;
    if (a < awayGoalDist.length) awayGoalDist[a]++;

    const key = `${h}-${a}`;
    scoreDist.set(key, (scoreDist.get(key) ?? 0) + 1);
  }

  return {
    simulations,
    stats: {
      homeWinPct: homeWins / iterations,
      drawPct: draws / iterations,
      awayWinPct: awayWins / iterations,
      avgHomeGoals: totalHomeGoals / iterations,
      avgAwayGoals: totalAwayGoals / iterations,
      goalDistribution: {
        home: homeGoalDist.map((c) => c / iterations),
        away: awayGoalDist.map((c) => c / iterations),
      },
      scoreDistribution: new Map(
        [...scoreDist.entries()].map(([k, v]) => [k, v / iterations]),
      ),
    },
  };
}

/** Sample from a Poisson distribution (Knuth algorithm). */
function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------------------
// 5. Wilson Confidence Interval
// ---------------------------------------------------------------------------

/**
 * Calculate the Wilson score confidence interval for a binomial proportion.
 *
 * This is more accurate than the normal approximation, especially for
 * small samples or extreme proportions.
 *
 * @param successes  Number of successful outcomes (e.g. wins).
 * @param total      Total number of trials.
 * @param z          Z-score for the desired confidence level (default 1.96 ≈ 95%).
 */
export function wilsonConfidenceInterval(
  successes: number,
  total: number,
  z: number = 1.96,
): WilsonInterval {
  if (total === 0) return { lower: 0, upper: 0, center: 0 };

  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center =
    (p + (z * z) / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) /
    denominator;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
  };
}

// ---------------------------------------------------------------------------
// 6. Expected Goals (xG) from Shots
// ---------------------------------------------------------------------------

/**
 * Calculate cumulative xG from an array of shot descriptors.
 *
 * Uses a simplified distance-and-angle model:
 *  - Base probability from distance to goal (0.79 m wide × 2.44 m tall,
 *    converted from normalised pitch coordinates).
 *  - Penalties are fixed at 0.75.
 *  - Headers receive a 0.3× multiplier.
 *  - Free kicks get a 1.2× bonus.
 *
 * @param shots  Array of shot descriptors with x/y position, type, and body part.
 */
export function calculateXg(shots: Shot[]): XgResult {
  // Goal dimensions in normalised pitch units (pitch ≈ 105 × 68 m)
  // The goal is 7.32 m wide on a 68 m-wide pitch → normalised width ≈ 0.1076
  // Posts at y ≈ 0.5 ± 0.054
  // Crossbar at height ~2.44 m (modelled as distance penalty)
  const GOAL_HALF_WIDTH = 0.054;

  const shotXgs: number[] = shots.map((shot) => {
    // Penalty: fixed value
    if (shot.type === 'penalty') return 0.75;

    // Distance from goal line (1 - x), scaled to approximate metres
    const distToGoal = (1 - shot.x) * 105;

    // Angle to goal posts
    const yDist = Math.abs(shot.y - 0.5);
    const goalAngle = Math.atan2(GOAL_HALF_WIDTH * 68, distToGoal) * 2;

    // Base xG: exponential decay with distance, boosted by angle
    let xg = Math.exp(-0.15 * distToGoal) * (goalAngle / Math.PI) * 1.2;

    // Type modifiers
    if (shot.type === 'free_kick') xg *= 1.2;

    // Body part modifiers
    if (shot.bodyPart === 'head' || shot.type === 'header') xg *= 0.3;
    else if (shot.bodyPart === 'other') xg *= 0.5;

    return clamp(xg, 0.01, 0.95);
  });

  return {
    total: shotXgs.reduce((sum, v) => sum + v, 0),
    shotXgs,
  };
}

// ---------------------------------------------------------------------------
// 7. Form Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a team's form rating, momentum, and trend from recent results.
 *
 * @param results  Array of match results: 'W', 'D', or 'L'.
 *                 Most recent match should be the last element.
 */
export function calculateForm(results: string[]): FormResult {
  if (results.length === 0) {
    return { formRating: 0, momentum: 50, trend: 'stable' };
  }

  // Points per result (weighted towards recency)
  const weights = results.map((_, i) => {
    // More recent results get exponentially higher weight
    return Math.pow(1.15, i);
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let weightedPoints = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i].toUpperCase();
    const points = r === 'W' ? 3 : r === 'D' ? 1 : 0;
    weightedPoints += points * weights[i];
  }

  // Normalise: 0 points → -1, 3 points → +1
  const maxPossible = 3 * totalWeight;
  const formRating = clamp((2 * weightedPoints) / maxPossible - 1, -1, 1);

  // Momentum: 0-100 based on recent performance burst
  const recentSlice = results.slice(-5);
  const recentWins = recentSlice.filter((r) => r.toUpperCase() === 'W').length;
  const momentum = clamp(
    50 + (recentWins - recentSlice.length / 2) * 15,
    0,
    100,
  );

  // Trend: compare first half vs second half of results
  const mid = Math.floor(results.length / 2);
  const firstHalf = results.slice(0, mid);
  const secondHalf = results.slice(mid);

  const halfPoints = (arr: string[]) =>
    arr.reduce((sum, r) => {
      const u = r.toUpperCase();
      return sum + (u === 'W' ? 3 : u === 'D' ? 1 : 0);
    }, 0);

  const firstPts = halfPoints(firstHalf);
  const secondPts = halfPoints(secondHalf);

  let trend: 'improving' | 'declining' | 'stable';
  const diff = secondPts - firstPts;
  if (diff > 2) trend = 'improving';
  else if (diff < -2) trend = 'declining';
  else trend = 'stable';

  return { formRating, momentum, trend };
}

// ---------------------------------------------------------------------------
// 8. Team Comparison
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive comparison between two teams, incorporating
 * ELO ratings, recent form, playing style, and tactical matchup analysis.
 *
 * @param home  Home team data.
 * @param away  Away team data.
 */
export function teamComparison(
  home: TeamData,
  away: TeamData,
): TeamComparisonResult {
  // ELO gap
  const eloGap = home.elo - away.elo;
  const eloAdvantage: 'home' | 'away' | 'even' =
    eloGap > 50 ? 'home' : eloGap < -50 ? 'away' : 'even';

  // Form
  const homeForm = calculateForm(home.form);
  const awayForm = calculateForm(away.form);
  const formDiff = homeForm.formRating - awayForm.formRating;
  const formAdvantage: 'home' | 'away' | 'even' =
    formDiff > 0.2 ? 'home' : formDiff < -0.2 ? 'away' : 'even';

  // Style clash rating (how tactically interesting the matchup is)
  let styleClashRating = 50; // baseline
  const homeStyle = home.style ?? 'balanced';
  const awayStyle = away.style ?? 'balanced';

  // Certain matchups are more tactically fascinating
  const clashBonus: Record<string, Record<string, number>> = {
    possession: { counter_attack: 25, direct: 15, defensive: 20 },
    counter_attack: { possession: 25, direct: 10, defensive: 15 },
    direct: { possession: 15, counter_attack: 10, defensive: 20 },
    defensive: { possession: 20, direct: 20, counter_attack: 15 },
  };
  styleClashRating += clashBonus[homeStyle]?.[awayStyle] ?? 0;

  // Boost if both teams are strong (higher average goals scored)
  const avgStrength =
    (home.avgGoalsScored + away.avgGoalsScored) / (2 * 1.35);
  styleClashRating += clamp((avgStrength - 1) * 10, 0, 15);

  styleClashRating = clamp(Math.round(styleClashRating), 0, 100);

  // Head-to-head advice narrative
  const advice = generateMatchAdvice(home, away, eloGap, homeForm, awayForm);

  return {
    eloGap,
    eloAdvantage,
    formComparison: {
      home: homeForm,
      away: awayForm,
      advantage: formAdvantage,
    },
    styleClashRating,
    headToHeadAdvice: advice,
  };
}

function generateMatchAdvice(
  home: TeamData,
  away: TeamData,
  eloGap: number,
  homeForm: FormResult,
  awayForm: FormResult,
): string {
  const parts: string[] = [];

  // ELO-based assessment
  if (eloGap > 150) {
    parts.push(
      `${home.name} hold a dominant ELO advantage (+${eloGap} pts) and are strong favourites.`,
    );
  } else if (eloGap > 50) {
    parts.push(
      `${home.name} have a notable ELO edge (+${eloGap} pts), especially with home advantage.`,
    );
  } else if (eloGap > -50) {
    parts.push(
      'The teams are closely matched on ratings — this could go either way.',
    );
  } else if (eloGap > -150) {
    parts.push(
      `${away.name} carry a slight ratings advantage despite being on the road.`,
    );
  } else {
    parts.push(
      `${away.name} are significant favourites on paper (+${Math.abs(eloGap)} pts ELO gap).`,
    );
  }

  // Form assessment
  if (homeForm.trend === 'improving' && homeForm.momentum > 60) {
    parts.push(
      `${home.name} are building momentum with improving form (rating: ${homeForm.momentum}/100).`,
    );
  } else if (homeForm.trend === 'declining' && homeForm.momentum < 40) {
    parts.push(
      `${home.name}'s form is slipping — be cautious backing them despite home advantage.`,
    );
  }

  if (awayForm.trend === 'improving' && awayForm.momentum > 60) {
    parts.push(
      `${away.name} are on the up and could cause an upset.`,
    );
  } else if (awayForm.trend === 'declining') {
    parts.push(`${away.name} are in a rut and may struggle here.`);
  }

  // Style-based insight
  if (home.style === 'possession' && away.style === 'counter_attack') {
    parts.push(
      "Classic possession vs. counter-attack — if the away side can absorb pressure, they'll be dangerous on the break.",
    );
  } else if (home.style === 'defensive' && away.style === 'possession') {
    parts.push(
      'Expect the away side to dominate the ball, but breaking down a low block is never easy.',
    );
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// 9. Halftime Adjustment
// ---------------------------------------------------------------------------

/**
 * Generate second-half prediction adjustments based on first-half events.
 *
 * Factors considered: goals scored/conceded, red cards, sustained pressure.
 *
 * @param firstHalfEvents  Array of events from the first half.
 */
export function halftimeAdjustment(
  firstHalfEvents: FirstHalfEvent[],
): HalftimeAdjustmentResult {
  let homeGoalAdj = 0;
  let awayGoalAdj = 0;
  let homeWinAdj = 0;
  let drawAdj = 0;
  let awayWinAdj = 0;
  const narratives: string[] = [];

  const homeGoals = firstHalfEvents.filter(
    (e) => e.type === 'goal' && e.team === 'home',
  ).length;
  const awayGoals = firstHalfEvents.filter(
    (e) => e.type === 'goal' && e.team === 'away',
  ).length;
  const homeReds = firstHalfEvents.filter(
    (e) => e.type === 'red_card' && e.team === 'home',
  ).length;
  const awayReds = firstHalfEvents.filter(
    (e) => e.type === 'red_card' && e.team === 'away',
  ).length;
  const homeYellows = firstHalfEvents.filter(
    (e) => e.type === 'yellow_card' && e.team === 'home',
  ).length;
  const awayYellows = firstHalfEvents.filter(
    (e) => e.type === 'yellow_card' && e.team === 'away',
  ).length;

  // Goal difference adjustments — leading teams tend to concede fewer, score fewer
  const goalDiff = homeGoals - awayGoals;
  if (goalDiff >= 2) {
    // Home comfortably ahead → they may ease off
    homeGoalAdj -= 0.15;
    awayGoalAdj -= 0.25;
    homeWinAdj += 0.08;
    drawAdj -= 0.05;
    awayWinAdj -= 0.03;
    narratives.push(
      'The home side is in control. Expect them to manage the game in the second half.',
    );
  } else if (goalDiff === 1) {
    homeGoalAdj -= 0.05;
    awayGoalAdj += 0.1; // trailing side pushes harder
    homeWinAdj += 0.04;
    drawAdj -= 0.02;
    narratives.push(
      'Narrow lead for the home side — the away team will likely push for an equaliser.',
    );
  } else if (goalDiff === -1) {
    homeGoalAdj += 0.1;
    awayGoalAdj -= 0.05;
    awayWinAdj += 0.04;
    drawAdj -= 0.02;
    narratives.push(
      'The away side lead but the home team should respond with more urgency.',
    );
  } else if (goalDiff <= -2) {
    homeGoalAdj += 0.25;
    awayGoalAdj -= 0.15;
    awayWinAdj += 0.08;
    drawAdj -= 0.05;
    homeWinAdj -= 0.03;
    narratives.push(
      'The away side is dominant. The home side face an uphill battle.',
    );
  } else {
    // 0-0
    narratives.push(
      'Goalless at the break. Both teams may open up slightly in search of a breakthrough.',
    );
    homeGoalAdj += 0.05;
    awayGoalAdj += 0.05;
  }

  // Red card adjustments
  if (homeReds > 0) {
    homeGoalAdj -= 0.35 * homeReds;
    awayGoalAdj += 0.25 * homeReds;
    homeWinAdj -= 0.12 * homeReds;
    awayWinAdj += 0.10 * homeReds;
    drawAdj += 0.02;
    narratives.push(
      'Disaster for the home side — a red card significantly shifts the balance.',
    );
  }
  if (awayReds > 0) {
    awayGoalAdj -= 0.35 * awayReds;
    homeGoalAdj += 0.25 * awayReds;
    awayWinAdj -= 0.12 * awayReds;
    homeWinAdj += 0.10 * awayReds;
    drawAdj += 0.02;
    narratives.push(
      `The away side are down to ${11 - awayReds} men — big advantage for the home side.',
    );
  }

  // Yellow card pressure indicator
  if (homeYellows >= 3) {
    homeGoalAdj -= 0.05;
    narratives.push(
      'The home side have racked up bookings and may need to tread carefully.',
    );
  }
  if (awayYellows >= 3) {
    awayGoalAdj -= 0.05;
    narratives.push(
      'Discipline concerns for the away side with multiple yellow cards.'
    );
  }

  // Normalise probability adjustments so they sum to ~0
  const totalProbAdj = homeWinAdj + drawAdj + awayWinAdj;
  homeWinAdj -= totalProbAdj / 3;
  drawAdj -= totalProbAdj / 3;
  awayWinAdj -= totalProbAdj / 3;

  return {
    homeGoalAdjustment: Math.round(homeGoalAdj * 1000) / 1000,
    awayGoalAdjustment: Math.round(awayGoalAdj * 1000) / 1000,
    homeWinProbAdjustment: Math.round(homeWinAdj * 1000) / 1000,
    drawProbAdjustment: Math.round(drawAdj * 1000) / 1000,
    awayWinProbAdjustment: Math.round(awayWinAdj * 1000) / 1000,
    narrative: narratives.join(' '),
  };
}

// ---------------------------------------------------------------------------
// 10. Tactical Insight Generation
// ---------------------------------------------------------------------------

/**
 * Generate a tactical analysis narrative based on in-match statistics.
 *
 * @param matchData  Current or post-match statistics.
 */
export function generateTacticalInsight(matchData: MatchStats): string {
  const insights: string[] = [];

  // Possession analysis
  const possDiff = matchData.homePossession - matchData.awayPossession;
  if (possDiff > 15) {
    insights.push(
      `The home side are dominating possession (${matchData.homePossession}%). They're likely dictating the tempo and forcing the opposition into a reactive game.',
    );
  } else if (possDiff < -15) {
    insights.push(
      `The away team have seized control of the ball (${matchData.awayPossession}%). The home side are being forced to chase the game.`,
    );
  } else {
    insights.push(
      'Possession is evenly shared, suggesting a balanced and competitive encounter.',
    );
  }

  // Shot efficiency
  const homeShotAcc =
    matchData.homeShots > 0
      ? matchData.homeShotsOnTarget / matchData.homeShots
      : 0;
  const awayShotAcc =
    matchData.awayShots > 0
      ? matchData.awayShotsOnTarget / matchData.awayShots
      : 0;

  if (homeShotAcc > 0.5 && matchData.homeShots >= 5) {
    insights.push(
      `Impressive shooting accuracy from the home team (${Math.round(homeShotAcc * 100)}% on target). They're creating quality chances.`,
    );
  } else if (homeShotAcc < 0.25 && matchData.homeShots >= 5) {
    insights.push(
      `The home side are struggling to hit the target (${Math.round(homeShotAcc * 100)}% accuracy) — they need to be more clinical.`,
    );
  }

  if (awayShotAcc > 0.5 && matchData.awayShots >= 5) {
    insights.push(
      `The away team are efficient in front of goal (${Math.round(awayShotAcc * 100)}% on target).`,
    );
  }

  // xG comparison
  if (matchData.homeXg !== undefined && matchData.awayXg !== undefined) {
    const xgDiff = matchData.homeXg - matchData.awayXg;
    if (Math.abs(xgDiff) > 0.5) {
      const favoured =
        xgDiff > 0 ? 'the home side' : 'the away team';
      insights.push(
        `Expected goals favour ${favoured} significantly (${Math.max(matchData.homeXg, matchData.awayXg).toFixed(2)} vs ${Math.min(matchData.homeXg, matchData.awayXg).toFixed(2)} xG).`,
      );
    }
  }

  // Corner analysis (proxy for attacking pressure)
  const cornerDiff = matchData.homeCorners - matchData.awayCorners;
  if (cornerDiff > 4) {
    insights.push(
      'The home side are generating sustained pressure, as evidenced by a significant corner count advantage.',
    );
  } else if (cornerDiff < -4) {
    insights.push(
      'The away team are applying most of the pressure, winning far more corners.',
    );
  }

  // Pass accuracy
  const passDiff = matchData.homePassAccuracy - matchData.awayPassAccuracy;
  if (passDiff > 10) {
    insights.push(
      `Home side's superior passing (${matchData.homePassAccuracy}% accuracy) is helping them control the midfield.`,
    );
  } else if (passDiff < -10) {
    insights.push(
      `Away team's passing accuracy (${matchData.awayPassAccuracy}%) is notably better, indicating better ball retention.`,
    );
  }

  // Fouls (aggression indicator)
  const foulDiff = matchData.homeFouls - matchData.awayFouls;
  if (foulDiff > 5) {
    insights.push(
      'The home side are committing considerably more fouls — they may be struggling to contain the opposition.',
    );
  } else if (foulDiff < -5) {
    insights.push(
      'The away team are the more physical side, racking up fouls as they try to disrupt the home team\'s rhythm.',
    );
  }

  return insights.join('\n\n');
}

// ---------------------------------------------------------------------------
// 11. Match Momentum
// ---------------------------------------------------------------------------

/**
 * Calculate a momentum timeline throughout a match based on events.
 *
 * Each event shifts the momentum balance between the two teams.
 * Momentum decays naturally over time and spikes with significant events.
 *
 * @param events  Array of match events with minute, type, and team.
 */
export function calculateMatchMomentum(
  events: MatchEvent[],
): MomentumPoint[] {
  // Sort events by minute
  const sorted = [...events].sort((a, b) => a.minute - b.minute);

  // Impact weights for different event types
  const impactWeights: Record<string, number> = {
    goal: 30,
    red_card: 25,
    yellow_card: 5,
    shot_on_target: 8,
    shot_off_target: 3,
    corner: 4,
    dangerous_attack: 3,
    substitution: 2,
  };

  const timeline: MomentumPoint[] = [];
  let currentHomeMomentum = 0; // range: -100 to 100

  // Track last event minute for decay
  let lastMinute = 0;

  // Generate momentum at each event minute
  for (const event of sorted) {
    const minutesSinceLast = event.minute - lastMinute;

    // Natural decay towards 0 (momentum equalises over time without events)
    const decayFactor = Math.exp(-0.02 * minutesSinceLast);
    currentHomeMomentum *= decayFactor;

    // Apply event impact
    const impact = event.impact ?? impactWeights[event.type] ?? 3;
    const direction = event.team === 'home' ? 1 : -1;
    currentHomeMomentum = clamp(currentHomeMomentum + direction * impact, -100, 100);

    timeline.push({
      minute: event.minute,
      homeMomentum: Math.round(currentHomeMomentum * 10) / 10,
      awayMomentum: Math.round(-currentHomeMomentum * 10) / 10,
    });

    lastMinute = event.minute;
  }

  // Add a final point at minute 90 (or the last event + 5)
  const finalMinute = Math.max(90, sorted.length > 0 ? sorted[sorted.length - 1].minute + 5 : 90);
  const totalDecay = Math.exp(-0.02 * (finalMinute - lastMinute));
  currentHomeMomentum *= totalDecay;

  timeline.push({
    minute: finalMinute,
    homeMomentum: Math.round(currentHomeMomentum * 10) / 10,
    awayMomentum: Math.round(-currentHomeMomentum * 10) / 10,
  });

  return timeline;
}

// ---------------------------------------------------------------------------
// 12. Weather Impact
// ---------------------------------------------------------------------------

/**
 * Estimate the impact of weather conditions on expected goals.
 *
 * Extreme weather tends to reduce goal expectancy by disrupting
 * passing accuracy, shooting technique, and overall match tempo.
 *
 * @param weather      Weather condition descriptor.
 * @param temperature  Temperature in Celsius.
 */
export function weatherImpact(
  weather: string,
  temperature: number,
): WeatherImpactResult {
  let modifier = 1.0;
  const narratives: string[] = [];

  const w = weather.toLowerCase();

  // Weather conditions
  if (w.includes('heavy rain') || w.includes('downpour') || w.includes('torrential')) {
    modifier *= 0.82;
    narratives.push(
      'Heavy rain significantly disrupts passing and shooting accuracy, reducing expected goals.',
    );
  } else if (w.includes('rain') || w.includes('drizzle') || w.includes('showers')) {
    modifier *= 0.92;
    narratives.push(
      'Light rain has a mild negative effect on goal expectancy due to a slicker ball and surface.',
    );
  }

  if (w.includes('snow') || w.includes('blizzard')) {
    modifier *= 0.72;
    narratives.push(
      'Snow severely impacts match quality — expect far fewer goals than usual.',
    );
  }

  if (w.includes('strong wind') || w.includes('gale') || w.includes('storm')) {
    modifier *= 0.85;
    narratives.push(
      'Strong winds make long passes and shots unpredictable, lowering scoring chances.',
    );
  } else if (w.includes('wind') || w.includes('breezy')) {
    modifier *= 0.95;
    narratives.push(
      'A moderate breeze has a slight dampening effect on goal expectancy.',
    );
  }

  if (w.includes('extreme heat') || w.includes('heatwave')) {
    modifier *= 0.88;
    narratives.push(
      'Extreme heat causes fatigue, reducing the intensity and goal output in the second half.',
    );
  }

  if (w.includes('fog')) {
    modifier *= 0.90;
    narratives.push(
      'Fog reduces visibility and can affect long-range shooting and passing.',
    );
  }

  if (w.includes('clear') || w.includes('sunny') || w.includes('fair')) {
    modifier *= 1.02;
    narratives.push(
      'Ideal conditions — no significant weather impact on expected goals.',
    );
  }

  // Temperature effects
  if (temperature > 35) {
    modifier *= 0.88;
    narratives.push(
      'Temperatures above 35°C will lead to significant fatigue and reduced goal output.',
    );
  } else if (temperature > 30) {
    modifier *= 0.94;
    narratives.push(
      'High temperatures (30-35°C) may cause some fatigue, especially in the second half.',
    );
  } else if (temperature < -5) {
    modifier *= 0.85;
    narratives.push(
      'Freezing conditions will make the ball behave unpredictably and increase injury risk.',
    );
  } else if (temperature < 0) {
    modifier *= 0.92;
    narratives.push(
      'Sub-zero temperatures slightly reduce the quality of play and goal expectancy.',
    );
  } else if (temperature >= 15 && temperature <= 25) {
    // Optimal range — already at 1.0 modifier
    if (narratives.length === 0) {
      narratives.push(
        'Perfect playing conditions — no weather-related adjustments needed.',
      );
    }
  }

  // Clamp modifier to reasonable bounds
  modifier = clamp(modifier, 0.6, 1.1);

  return {
    goalModifier: Math.round(modifier * 1000) / 1000,
    narrative: narratives.join(' '),
  };
}