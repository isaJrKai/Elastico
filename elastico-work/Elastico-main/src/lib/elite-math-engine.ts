/**
 * ELASTICO — Elite Mathematics Engine
 *
 * 20 production-grade sports analytics equations ported from Python/NumPy
 * to pure TypeScript. Runs natively on Node.js / Vercel serverless.
 *
 * Equations implemented:
 *   1.  Kinematic Time-to-Intercept (T_i)
 *   2.  Logistic Space Dominance (P_Home)
 *   3.  Pitch-Control Influence Decay (I_i)
 *   4.  Instantaneous Velocity & Acceleration
 *   5.  Kinetic Energy & Work Load
 *   6.  Geometric Shot Angle (theta)
 *   7.  Shot Distance to Goal Center
 *   8.  Logistic Regressed xG
 *   9.  Shot Velocity
 *  10. xG on Target (xGOT)
 *  11. Closest Distance of Approach (CDA)
 *  12. Dynamic Pass Completion Probability
 *  13. Expected Assists (xA)
 *  14. Pass Sonar Angular Distribution
 *  15. Convex Hull Area
 *  16. Team Centroid
 *  17. Defensive Line Height
 *  18. xT Value Transitions (ΔxT)
 *  19. PPDA (Passes Per Defensive Action)
 *  20. Euclidean Scouting Distance Matrix
 */

import { XT_GRID, XT_ROWS, XT_COLS, coordsToGrid, getXT, calculateActionXT } from './xt-engine'

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const GOAL_WIDTH = 7.32   // meters (FIFA standard)
const PITCH_LENGTH = 105.0
const PITCH_WIDTH = 68.0
const GOAL_CENTER_Y = PITCH_WIDTH / 2
const POST1_Y = GOAL_CENTER_Y - GOAL_WIDTH / 2  // 30.34
const POST2_Y = GOAL_CENTER_Y + GOAL_WIDTH / 2  // 37.66

// xG logistic regression coefficients (calibrated baseline)
const XG_BETA = { intercept: 0.35, angle: 1.15, distance: -0.12 }

// Body part modifiers (empirical weights from historical data)
const BODY_PART_MODIFIERS: Record<string, number> = {
  'Right Foot': 0.42,
  'Left Foot': 0.30,
  'Strong Foot': 0.42,
  'Weak Foot': -0.15,
  'Head': -0.85,
  'Other': -0.50,
  'Chest': -0.95,
}

// ═══════════════════════════════════════════════════════════════════════════════
// VECTOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

type Vec2 = [number, number]
type Vec3 = [number, number, number]

function dist(a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  return Math.sqrt(dx * dx + dy * dy)
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function dot(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1]
}

function mag(v: Vec2): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1])
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]]
}

function add(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]]
}

function scale(v: Vec2, s: number): Vec2 {
  return [v[0] * s, v[1] * s]
}

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-x))
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function radToDeg(r: number): number {
  return r * (180 / Math.PI)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: PLAYER TRACKING & KINETIC MOVEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Eq 1: Kinematic Time-to-Intercept
 * T_i(x) = t_react + ||x - (x_i + v_i * t_react)|| / V_max
 */
export function timeToIntercept(
  target: Vec2,
  playerPos: Vec2,
  playerVel: Vec2,
  vMax = 8.0,
  tReact = 0.2
): number {
  const posAfterReaction: Vec2 = [
    playerPos[0] + playerVel[0] * tReact,
    playerPos[1] + playerVel[1] * tReact,
  ]
  const d = dist(target, posAfterReaction)
  return +(tReact + d / vMax).toFixed(3)
}

/**
 * Eq 2: Logistic Space Dominance
 * P_Home(x) = 1 / (1 + e^(-λ * (T_away - T_home)))
 */
export function logisticSpaceDominance(
  tHome: number, tAway: number, lambda = 2.0
): number {
  return +sigmoid(lambda * (tAway - tHome)).toFixed(4)
}

/**
 * Eq 3: Pitch-Control Influence Decay
 * I_i(x, t) = exp(-||x - x_i(t)||^2 / (2 * σ_i(t)^2))
 */
export function influenceDecay(
  target: Vec2, playerPos: Vec2, sigma = 15.0
): number {
  const d2 = Math.pow(target[0] - playerPos[0], 2) + Math.pow(target[1] - playerPos[1], 2)
  return +Math.exp(-d2 / (2 * sigma * sigma)).toFixed(6)
}

/**
 * Eq 4: Instantaneous Velocity & Acceleration
 * v(t) = (x(t) - x(t-dt)) / dt
 * a(t) = (v(t) - v(t-dt)) / dt
 */
export function velocityAndAcceleration(
  positions: Array<{ x: number; y: number; t: number }>
): Array<{ velocity: Vec2; speed: number; acceleration: Vec2; accelMag: number }> {
  const results: Array<{ velocity: Vec2; speed: number; acceleration: Vec2; accelMag: number }> = []
  let prevVel: Vec2 | null = null

  for (let i = 1; i < positions.length; i++) {
    const dt = positions[i].t - positions[i - 1].t
    if (dt <= 0) continue

    const vel: Vec2 = [
      (positions[i].x - positions[i - 1].x) / dt,
      (positions[i].y - positions[i - 1].y) / dt,
    ]
    const speed = mag(vel)

    let accel: Vec2 = [0, 0]
    let accelMag = 0
    if (prevVel) {
      const dt2 = dt
      accel = [(vel[0] - prevVel[0]) / dt2, (vel[1] - prevVel[1]) / dt2]
      accelMag = mag(accel)
    }

    results.push({ velocity: vel, speed: +speed.toFixed(2), acceleration: accel, accelMag: +accelMag.toFixed(2) })
    prevVel = vel
  }
  return results
}

/**
 * Eq 5: Kinetic Energy & Work Load
 * W ≈ Σ m * ||a(t)|| * ||v(t)|| * dt
 */
export function kineticWorkLoad(
  kinematics: Array<{ speed: number; accelMag: number; dt: number }>,
  playerMassKg = 75.0
): number {
  let work = 0
  for (const k of kinematics) {
    work += playerMassKg * k.accelMag * k.speed * k.dt
  }
  return +work.toFixed(2)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: SPATIAL EVENT & SHOOTING ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Eq 6: Geometric Shot Angle
 * θ = arccos((a² + b² - w²) / (2ab))
 */
export function shotAngle(x: number, y: number): number {
  const shotPoint: Vec2 = [x, y]
  const post1: Vec2 = [PITCH_LENGTH, POST1_Y]
  const post2: Vec2 = [PITCH_LENGTH, POST2_Y]

  const a = dist(shotPoint, post1)
  const b = dist(shotPoint, post2)
  const w = GOAL_WIDTH

  const cosTheta = (a * a + b * b - w * w) / (2 * a * b + 1e-10)
  return +radToDeg(Math.acos(clamp(cosTheta, -1, 1))).toFixed(2)
}

/**
 * Eq 7: Shot Distance to Goal Center
 * d = √((L - x)² + (W/2 - y)²)
 */
export function shotDistance(x: number, y: number): number {
  return +Math.sqrt(Math.pow(PITCH_LENGTH - x, 2) + Math.pow(GOAL_CENTER_Y - y, 2)).toFixed(2)
}

/**
 * Eq 8: Logistic Regressed xG
 * xG = 1 / (1 + e^(-(β₀ + β₁·θ + β₂·d + β₃·c)))
 */
export function calculateXG(
  x: number, y: number, bodyPart = 'Strong Foot'
): number {
  const theta = shotAngle(x, y) * (Math.PI / 180) // convert to radians
  const d = shotDistance(x, y)
  const c = BODY_PART_MODIFIERS[bodyPart] ?? 0.0

  const logOdds = XG_BETA.intercept + (XG_BETA.angle * theta) + (XG_BETA.distance * d) + c
  return +sigmoid(logOdds).toFixed(4)
}

/**
 * Batch xG: Calculate for multiple shots at once
 */
export function batchCalculateXG(
  shots: Array<{ x: number; y: number; bodyPart?: string }>
): number[] {
  return shots.map(s => calculateXG(s.x, s.y, s.bodyPart))
}

/**
 * Eq 9: Shot Velocity
 * V_ball = √((x_impact - x_origin)² + (y_impact - y_origin)²) / (t_impact - t_origin)
 */
export function shotVelocity(
  origin: Vec2, impact: Vec2, timeDelta: number
): number {
  if (timeDelta <= 0) return 0
  return +(dist(origin, impact) / timeDelta).toFixed(2)
}

/**
 * Eq 10: xG on Target (xGOT)
 * xGOT = 1 / (1 + e^(-(α₀ + α₁·xG + α₂·z_goal + α₃·y_goal)))
 * z_goal = height of shot on target (0=ground, 1=crossbar)
 * y_goal = horizontal placement (-1=left post, 0=center, 1=right post)
 */
export function xGOnTarget(
  xG: number, zGoal = 0.5, yGoal = 0.0
): number {
  const alpha0 = -0.5
  const alpha1 = 1.2
  const alpha2 = 0.3
  const alpha3 = 0.1

  const logOdds = alpha0 + (alpha1 * xG) + (alpha2 * zGoal) + (alpha3 * yGoal)
  return +sigmoid(logOdds).toFixed(4)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: PASSING MECHANICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Eq 11: Closest Distance of Approach (CDA)
 * t = clip(((p_j - o) · u) / ||u||², 0, 1)
 * D_min = ||o + t·u - p_j||
 */
export function passInterceptionCDA(
  origin: Vec2, destination: Vec2, defenders: Vec2[]
): { minDistance: number; closestDefenderIndex: number } {
  const o: Vec2 = origin
  const u: Vec2 = sub(destination, origin)
  const uNormSq = dot(u, u) + 1e-10

  let minDist = Infinity
  let minIdx = 0

  for (let j = 0; j < defenders.length; j++) {
    const p = defenders[j]
    const t = clamp(dot(sub(p, o), u) / uNormSq, 0, 1)
    const closestPoint = add(o, scale(u, t))
    const d = dist(closestPoint, p)
    if (d < minDist) {
      minDist = d
      minIdx = j
    }
  }

  return { minDistance: +minDist.toFixed(2), closestDefenderIndex: minIdx }
}

/**
 * Eq 12: Dynamic Pass Completion Probability
 * P_pass = 1 / (1 + e^(-(γ₀ + γ₁·D_min + γ₂·||u||)))
 */
export function passCompletionProbability(
  origin: Vec2, destination: Vec2, defenders: Vec2[]
): number {
  const { minDistance } = passInterceptionCDA(origin, destination, defenders)
  const passLength = dist(origin, destination)

  const gamma0 = 2.5
  const gamma1 = -1.8
  const gamma2 = -0.02

  const logOdds = gamma0 + (gamma1 * minDistance) + (gamma2 * passLength)
  return +sigmoid(logOdds).toFixed(4)
}

/**
 * Eq 13: Expected Assists (xA)
 * xA = P_pass × xG_shot_zone
 */
export function expectedAssist(
  origin: Vec2, destination: Vec2, defenders: Vec2[],
  shotX?: number, shotY?: number
): number {
  const pPass = passCompletionProbability(origin, destination, defenders)
  const xG = (shotX !== undefined && shotY !== undefined) ? calculateXG(shotX, shotY) : 0.1
  return +(pPass * xG).toFixed(4)
}

/**
 * Eq 14: Pass Sonar Angular Distribution
 * φ = atan2(y_end - y_start, x_end - x_start)
 */
export function passAngle(origin: Vec2, destination: Vec2): number {
  return +radToDeg(Math.atan2(destination[1] - origin[1], destination[0] - origin[0])).toFixed(2)
}

/**
 * Generate a full pass sonar distribution (8 directional bins)
 */
export function passSonarDistribution(
  passes: Array<{ startX: number; startY: number; endX: number; endY: number }>
): Array<{ direction: string; angleRange: [number, number]; count: number; pct: number }> {
  const bins = [
    { direction: 'Forward', range: [-22.5, 22.5] as [number, number], count: 0 },
    { direction: 'Forward-Right', range: [22.5, 67.5] as [number, number], count: 0 },
    { direction: 'Right', range: [67.5, 112.5] as [number, number], count: 0 },
    { direction: 'Back-Right', range: [112.5, 157.5] as [number, number], count: 0 },
    { direction: 'Backward', range: [157.5, 180] as [number, number], count: 0 },
    { direction: 'Backward', range: [-180, -157.5] as [number, number], count: 0 },
    { direction: 'Back-Left', range: [-157.5, -112.5] as [number, number], count: 0 },
    { direction: 'Left', range: [-112.5, -67.5] as [number, number], count: 0 },
    { direction: 'Forward-Left', range: [-67.5, -22.5] as [number, number], count: 0 },
  ]

  const total = passes.length || 1
  for (const p of passes) {
    const angle = Math.atan2(p.endY - p.startY, p.endX - p.startX) * (180 / Math.PI)
    for (const bin of bins) {
      if (angle >= bin.range[0] && angle < bin.range[1]) {
        bin.count++
        break
      }
    }
  }

  // Merge the two "Backward" bins
  const merged: Array<{ direction: string; angleRange: [number, number]; count: number; pct: number }> = [
    { direction: 'Forward', angleRange: [-22.5, 22.5], count: bins[0].count, pct: 0 },
    { direction: 'Forward-Right', angleRange: [22.5, 67.5], count: bins[1].count, pct: 0 },
    { direction: 'Right', angleRange: [67.5, 112.5], count: bins[2].count, pct: 0 },
    { direction: 'Back-Right', angleRange: [112.5, 157.5], count: bins[3].count, pct: 0 },
    { direction: 'Backward', angleRange: [157.5, -157.5], count: bins[4].count + bins[5].count, pct: 0 },
    { direction: 'Back-Left', angleRange: [-157.5, -112.5], count: bins[6].count, pct: 0 },
    { direction: 'Left', angleRange: [-112.5, -67.5], count: bins[7].count, pct: 0 },
    { direction: 'Forward-Left', angleRange: [-67.5, -22.5], count: bins[8].count, pct: 0 },
  ]

  for (const m of merged) m.pct = +((m.count / total) * 100).toFixed(1)
  return merged
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: TEAM TACTICAL METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Eq 15: Convex Hull Area (Shoelace Formula for tactical compactness)
 * A_hull = ½ |Σ(x_i * y_{i+1} - x_{i+1} * y_i)|
 */
export function convexHullArea(points: Vec2[]): number {
  if (points.length < 3) return 0

  // Graham scan to find convex hull
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const lower: Vec2[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Vec2[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }

  const hull = lower.slice(0, -1).concat(upper.slice(0, -1))
  if (hull.length < 3) return 0

  // Shoelace formula
  let area = 0
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length
    area += hull[i][0] * hull[j][1]
    area -= hull[j][0] * hull[i][1]
  }
  return +(Math.abs(area) / 2).toFixed(2)
}

/**
 * Eq 16: Team Centroid
 * C = (1/n Σ x_i, 1/n Σ y_i)
 */
export function teamCentroid(positions: Vec2[]): Vec2 {
  if (positions.length === 0) return [0, 0]
  const n = positions.length
  const cx = positions.reduce((sum, p) => sum + p[0], 0) / n
  const cy = positions.reduce((sum, p) => sum + p[1], 0) / n
  return [+cx.toFixed(2), +cy.toFixed(2)]
}

/**
 * Eq 17: Defensive Line Height
 * H_line = min(x_def_1, x_def_2, ..., x_def_n)
 */
export function defensiveLineHeight(defenderXCoords: number[]): number {
  if (defenderXCoords.length === 0) return 0
  return +Math.min(...defenderXCoords).toFixed(2)
}

/**
 * Defensive line height variance (how flat the back line is)
 */
export function defensiveLineVariance(defenderXCoords: number[]): number {
  if (defenderXCoords.length < 2) return 0
  const mean = defenderXCoords.reduce((a, b) => a + b, 0) / defenderXCoords.length
  const variance = defenderXCoords.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / defenderXCoords.length
  return +Math.sqrt(variance).toFixed(2)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: THREAT MODELING & SCOUTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Eq 18: xT Value Transition (delegates to xt-engine)
 * ΔxT = xT(end) - xT(start)
 * Re-exported here for completeness of the 20 equations.
 */
export { calculateActionXT as xTTransition, getXTGridForVisualization as xTGrid } from './xt-engine'

/**
 * Eq 19: PPDA (Passes Per Defensive Action)
 * PPDA = Opponent passes in attacking 60% zone / Defensive actions
 */
export function calculatePPDA(
  opponentPassesInAttackingZone: number,
  defensiveActions: number // tackles + interceptions + fouls
): number {
  if (defensiveActions === 0) return Infinity
  return +(opponentPassesInAttackingZone / defensiveActions).toFixed(2)
}

/**
 * Eq 20: Euclidean Scouting Distance Matrix (weighted normalized)
 * D_scout(p1, p2) = √(Σ w_k * ((f_k(p1) - μ_k)/σ_k - (f_k(p2) - μ_k)/σ_k)²)
 */
export function scoutingDistance(
  player1: number[], player2: number[],
  weights: number[], means: number[], stdDevs: number[]
): number {
  if (player1.length !== player2.length || player1.length !== weights.length) return Infinity

  let sumSq = 0
  for (let k = 0; k < player1.length; k++) {
    const std = stdDevs[k] || 1
    const norm1 = (player1[k] - means[k]) / std
    const norm2 = (player2[k] - means[k]) / std
    sumSq += weights[k] * Math.pow(norm1 - norm2, 2)
  }
  return +Math.sqrt(sumSq).toFixed(4)
}

/**
 * Find statistical twins using the scouting distance matrix.
 * Returns the N most similar players to a target player.
 */
export function findStatisticalTwins(
  targetFeatures: number[],
  playerPool: Array<{ name: string; features: number[] }>,
  weights: number[], means: number[], stdDevs: number[],
  topN = 5
): Array<{ name: string; distance: number }> {
  const scored = playerPool.map(p => ({
    name: p.name,
    distance: scoutingDistance(targetFeatures, p.features, weights, means, stdDevs),
  }))
  scored.sort((a, b) => a.distance - b.distance)
  return scored.slice(0, topN)
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full shot analysis: angle, distance, xG, xGOT in one call
 */
export function fullShotAnalysis(
  x: number, y: number, bodyPart = 'Strong Foot',
  zGoal = 0.5, yGoal = 0.0
) {
  const angle = shotAngle(x, y)
  const distance = shotDistance(x, y)
  const xg = calculateXG(x, y, bodyPart)
  const xgot = xGOnTarget(xg, zGoal, yGoal)
  return { angle, distance, xg, xgot, bodyPart, coordinates: { x, y } }
}

/**
 * Full pass analysis: CDA, completion prob, xA, xT gained, angle
 */
export function fullPassAnalysis(
  startX: number, startY: number,
  endX: number, endY: number,
  defenders: Vec2[],
  pitchLength = 105.0, pitchWidth = 68.0
) {
  const origin: Vec2 = [startX, startY]
  const destination: Vec2 = [endX, endY]

  const cda = passInterceptionCDA(origin, destination, defenders)
  const completionProb = passCompletionProbability(origin, destination, defenders)
  const xA = expectedAssist(origin, destination, defenders, endX, endY)
  const { xtGained } = calculateActionXT(startX, startY, endX, endY, pitchLength, pitchWidth)
  const angle = passAngle(origin, destination)
  const passLength = dist(origin, destination)

  return {
    cda,
    completionProb,
    xA,
    xtGained,
    angle,
    passLength: +passLength.toFixed(2),
    interceptionRisk: cda.minDistance < 1.2 ? 'HIGH' : cda.minDistance < 2.5 ? 'MEDIUM' : 'LOW',
  }
}

/**
 * Full team tactical snapshot: centroid, defensive line, convex hull, compactness
 */
export function teamTacticalSnapshot(
  playerPositions: Vec2[],
  defenderXCoords?: number[]
) {
  const centroid = teamCentroid(playerPositions)
  const hullArea = convexHullArea(playerPositions)
  const maxPitchArea = PITCH_LENGTH * PITCH_WIDTH
  const compactness = +((hullArea / maxPitchArea) * 100).toFixed(2)

  let defLine = 0
  let defLineVariance = 0
  if (defenderXCoords && defenderXCoords.length > 0) {
    defLine = defensiveLineHeight(defenderXCoords)
    defLineVariance = defensiveLineVariance(defenderXCoords)
  }

  return {
    centroid,
    hullArea,
    compactness, // % of pitch area covered by team shape
    defensiveLineHeight: defLine,
    defensiveLineVariance: defLineVariance,
    playerCount: playerPositions.length,
  }
}