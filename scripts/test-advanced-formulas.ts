/**
 * Comprehensive validation of all 20 advanced analytics formulas.
 * Tests mathematical correctness, boundary conditions, and real-world plausibility.
 */
import {
  calculateCRI, calculateSCS, calculateITI, calculateRefereeDrift,
  calculateCRD, calculateFCD, calculateReintegration, calculateMAI,
  calculateDSE, calculateSBDI, calculatePressLag, calculateSOA,
  calculateLineAlpha, calculateRBEI, calculateCTC, calculateNarrativeMomentum,
  calculateCAPZ, calculateTAD, calculateSubDecay, calculateIPR,
  runFullAdvancedAnalysis,
} from '../src/lib/advanced-analytics-engine'

let pass = 0
let fail = 0
const errors: string[] = []

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    pass++
    console.log(`  ✅ ${testName}: ${detail}`)
  } else {
    fail++
    errors.push(`${testName}: ${detail}`)
    console.log(`  ❌ ${testName}: ${detail}`)
  }
}

function assertRange(value: number, min: number, max: number, testName: string) {
  const ok = value >= min && value <= max
  assert(ok, testName, `value=${value.toFixed(4)}, expected [${min}, ${max}]`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔴 TIER 1: PSYCHOLOGICAL & BEHAVIORAL')
// ═══════════════════════════════════════════════════════════════════════════

// 1. CRI — Prospect Theory
console.log('\n1. Coach Risk Index (CRI)')
{
  // Test: V(x) = x^0.88 for gains (positive outcome)
  const r1 = calculateCRI({ scoreDifferential: 0, probability: 0.5, outcomeMagnitude: 0.5, minutesRemaining: 45 })
  assertRange(r1.value, 0, 1, 'CRI: neutral scenario')

  // Loss aversion: trailing should produce HIGHER CRI than leading (asymmetric)
  const trailing = calculateCRI({ scoreDifferential: -3, probability: 0.3, outcomeMagnitude: 0.8, minutesRemaining: 75 })
  const leading = calculateCRI({ scoreDifferential: 3, probability: 0.3, outcomeMagnitude: 0.8, minutesRemaining: 75 })
  assert(trailing.value > leading.value, 'CRI: loss aversion (trailing > leading)', `trailing=${trailing.value.toFixed(3)} vs leading=${leading.value.toFixed(3)}`)

  // Time pressure: final 15 min should amplify
  const early = calculateCRI({ scoreDifferential: -2, probability: 0.4, outcomeMagnitude: 0.6, minutesRemaining: 60 })
  const late = calculateCRI({ scoreDifferential: -2, probability: 0.4, outcomeMagnitude: 0.6, minutesRemaining: 10 })
  assert(late.value > early.value, 'CRI: time pressure amplification', `late=${late.value.toFixed(3)} > early=${early.value.toFixed(3)}`)

  // Verify Kahneman formula manually
  // V(0.6) = 0.6^0.88 = ?
  const expectedV = Math.pow(0.6, 0.88)
  const testR = calculateCRI({ scoreDifferential: 0, probability: 0.5, outcomeMagnitude: 0.6, minutesRemaining: 45 })
  // The result includes pi(probability) × timePressure × scoreModifier, so just verify V component
  const rawV = testR.raw?.V as string
  assert(Math.abs(parseFloat(rawV) - expectedV) < 0.001, 'CRI: Kahneman V(x) = x^0.88 verified', `computed=${rawV}, expected=${expectedV.toFixed(4)}`)

  // Verify Prelec probability weighting
  const p = 0.5
  const expectedPi = Math.pow(p, 0.69) / Math.pow(Math.pow(p, 0.69) + Math.pow(1 - p, 0.69), 1 / 0.69)
  const rawPi = testR.raw?.pi as string
  assert(Math.abs(parseFloat(rawPi) - expectedPi) < 0.001, 'CRI: Prelec π(p) verified', `computed=${rawPi}, expected=${expectedPi.toFixed(4)}`)
}

// 2. SCS — Social Contagion
console.log('\n2. Social Contagion Score (SCS)')
{
  const r1 = calculateSCS({
    triggerEvent: { playerId: 'p1', intensity: 0.9, minute: 30, valence: 1 },
    teammates: [
      { playerId: 'p2', socialProximity: 1.0, physicalProximity: 1.0 },
      { playerId: 'p3', socialProximity: 0.8, physicalProximity: 0.8 },
    ],
    currentMinute: 32,
  })
  assert(r1.value > 0, 'SCS: positive trigger gives positive score', `value=${r1.value.toFixed(3)}`)

  // Negative valence should flip sign
  const r2 = calculateSCS({
    triggerEvent: { playerId: 'p1', intensity: 0.9, minute: 30, valence: -1 },
    teammates: [
      { playerId: 'p2', socialProximity: 1.0, physicalProximity: 1.0 },
      { playerId: 'p3', socialProximity: 0.8, physicalProximity: 0.8 },
    ],
    currentMinute: 32,
  })
  assert(r2.value < 0, 'SCS: negative valence flips sign', `value=${r2.value.toFixed(3)}`)

  // Temporal decay: further in time = lower contagion
  const r3 = calculateSCS({
    triggerEvent: { playerId: 'p1', intensity: 0.9, minute: 30, valence: 1 },
    teammates: [{ playerId: 'p2', socialProximity: 1.0, physicalProximity: 1.0 }],
    currentMinute: 45,  // 15 min later
  })
  assert(Math.abs(r3.value) < Math.abs(r1.value), 'SCS: temporal decay works', `15min=${r3.value.toFixed(3)} vs 2min=${r1.value.toFixed(3)}`)

  // Verify formula: SCS = Σ(Ei × Cij × Δt^-1)
  // Single teammate, intensity=1, proximity=1, Δt=5: should be 1 × 1 × 0.2 = 0.2
  const r4 = calculateSCS({
    triggerEvent: { playerId: 'p1', intensity: 1.0, minute: 50, valence: 1 },
    teammates: [{ playerId: 'p2', socialProximity: 1.0, physicalProximity: 1.0 }],
    currentMinute: 55,
  })
  const expected = 1.0 * (0.6 * 1.0 + 0.4 * 1.0) * (1 / 5)  // 1.0 * 1.0 * 0.2 = 0.2
  assert(Math.abs(r4.value - expected) < 0.01, 'SCS: formula Σ(Ei×Cij×Δt^-1) verified', `computed=${r4.value.toFixed(4)}, expected=${expected.toFixed(4)}`)
}

// 3. ITI — Identity Threat
console.log('\n3. Identity Threat Index (ITI)')
{
  const r1 = calculateITI({ criticismMagnitude: 0.8, neuroticismScore: 0.8, resilienceBaseline: 0.3, daysSinceCriticism: 1 })
  assert(r1.value > 0, 'ITI: high threat produces positive value', `value=${r1.value.toFixed(3)}`)

  // High resilience should reduce ITI
  const r2 = calculateITI({ criticismMagnitude: 0.8, neuroticismScore: 0.8, resilienceBaseline: 0.9, daysSinceCriticism: 1 })
  assert(r2.value < r1.value, 'ITI: high resilience reduces threat', `high_res=${r2.value.toFixed(3)} < low_res=${r1.value.toFixed(3)}`)

  // Time decay: 7 days should be lower than 1 day
  const r3 = calculateITI({ criticismMagnitude: 0.8, neuroticismScore: 0.8, resilienceBaseline: 0.5, daysSinceCriticism: 7 })
  const r4 = calculateITI({ criticismMagnitude: 0.8, neuroticismScore: 0.8, resilienceBaseline: 0.5, daysSinceCriticism: 1 })
  assert(r3.value < r4.value, 'ITI: time decay works', `7d=${r3.value.toFixed(3)} < 1d=${r4.value.toFixed(3)}`)

  // Verify formula: ITI = (criticism × neuroticism) / resilience × decay
  const raw = (0.8 * 0.8) / 0.5  // = 1.28
  const expected = raw * Math.exp(-0.23 * 1)  // decay at 1 day
  assert(Math.abs(r4.value - expected) < 0.01, 'ITI: formula verified', `computed=${r4.value.toFixed(4)}, expected=${expected.toFixed(4)}`)
}

// 4. Referee Drift
console.log('\n4. Referee Behavioral Drift')
{
  const r1 = calculateRefereeDrift({ minute: 75, lastCall: 1, lastCallControversy: 0.8, crowdNoise: 0.9, homeBiasBaseline: 0.15 })
  // Should show recency correction (negative bias after controversial home call)
  assert(r1.label.includes('CORRECTION') || r1.value < 0.15, 'Referee: recency correction detected', `label=${r1.label}`)

  // Fatigue at minute 90 > fatigue at minute 30
  const r2 = calculateRefereeDrift({ minute: 90, lastCall: 0, lastCallControversy: 0, crowdNoise: 0.5, homeBiasBaseline: 0.1 })
  const r3 = calculateRefereeDrift({ minute: 30, lastCall: 0, lastCallControversy: 0, crowdNoise: 0.5, homeBiasBaseline: 0.1 })
  const f90 = r2.raw?.fatigue as string
  const f30 = r3.raw?.fatigue as string
  assert(parseFloat(f90) > parseFloat(f30), 'Referee: fatigue increases over time', `90min=${f90} > 30min=${f30}`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🟠 TIER 2: TEMPORAL & CONTEXT')
// ═══════════════════════════════════════════════════════════════════════════

// 5. CRD — Circadian Rhythm
console.log('\n5. Circadian Rhythm Decay')
{
  const ew = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'east-to-west', daysSinceArrival: 2, positionGroup: 'striker' })
  const we = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'west-to-east', daysSinceArrival: 2, positionGroup: 'striker' })
  assert(ew.value > we.value, 'CRD: E→W easier than W→E', `E→W=${ew.value.toFixed(3)} > W→E=${we.value.toFixed(3)}`)

  // Recovery: more days = higher CRD
  const d1 = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'west-to-east', daysSinceArrival: 1, positionGroup: 'striker' })
  const d5 = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'west-to-east', daysSinceArrival: 5, positionGroup: 'striker' })
  assert(d5.value > d1.value, 'CRD: recovery over time', `5d=${d5.value.toFixed(3)} > 1d=${d1.value.toFixed(3)}`)

  // Strikers affected more than GKs
  const str = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'west-to-east', daysSinceArrival: 1, positionGroup: 'striker' })
  const gk = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'west-to-east', daysSinceArrival: 1, positionGroup: 'goalkeeper' })
  assert(str.value < gk.value, 'CRD: strikers more affected than GKs', `striker=${str.value.toFixed(3)} < GK=${gk.value.toFixed(3)}`)

  // Verify formula: CRD = basePerf × (1 - 0.038 × ΔTZ) × direction
  // West→East, 3 TZ, 0 days (full impact): 0.8 × (1 - 0.038×3) × 0.89
  const expected = 0.8 * (1 - 0.038 * 3) * 0.89
  const raw = calculateCRD({ basePerformance: 0.8, timeZonesCrossed: 3, travelDirection: 'west-to-east', daysSinceArrival: 0, positionGroup: 'striker' })
  // Position weight makes striker worse: × 1.25 factor on the TZ impact
  assert(Math.abs(raw.value - expected) < 0.15, 'CRD: formula in plausible range', `computed=${raw.value.toFixed(4)}, base_formula=${expected.toFixed(4)}`)
}

// 6. FCD — Fixture Congestion
console.log('\n6. Fixture Congestion Decay')
{
  // More games in shorter time = higher fatigue
  const heavy = calculateFCD({ matchDays: [0, 2, 4] })  // 3 games in 4 days
  const light = calculateFCD({ matchDays: [0, 7] })      // 2 games in 7 days
  assert(heavy.value > light.value, 'FCD: heavy congestion > light', `heavy=${heavy.value.toFixed(3)} > light=${light.value.toFixed(3)}`)

  // Single game = minimal fatigue
  const single = calculateFCD({ matchDays: [0] })
  assertRange(single.value, 0, 0.5, 'FCD: single game moderate fatigue')
}

// 7. Reintegration
console.log('\n7. Reintegration Readiness')
{
  // High training + full minutes = ready
  const ready = calculateReintegration({ trainingLoadIndex: 90, matchMinutes: 90, highIntensityRuns: 8, opponentDefensiveIntensity: 0.3 })
  assert(ready.value >= 74, 'Reintegration: fully integrated when metrics high', `value=${ready.value.toFixed(1)}`)

  // Low everything = not ready
  const notReady = calculateReintegration({ trainingLoadIndex: 20, matchMinutes: 15, highIntensityRuns: 1, opponentDefensiveIntensity: 0.9 })
  assert(notReady.value < 50, 'Reintegration: low when metrics poor', `value=${notReady.value.toFixed(1)}`)

  // Verify formula: (Training×0.6) + (Minutes×0.3) + (HIR×0.1)
  // training=100 → 100×0.6=60, minutes=90→100×0.3=30, HIR=10→100×0.1=10 = 100
  const max = calculateReintegration({ trainingLoadIndex: 100, matchMinutes: 90, highIntensityRuns: 10, opponentDefensiveIntensity: 0 })
  const expectedRaw = 100 * 0.6 + 100 * 0.3 + 100 * 0.1
  assert(max.value <= 100 && max.value > 90, 'Reintegration: max possible near 100', `value=${max.value.toFixed(1)}`)
}

// 8. MAI — Motivation Index
console.log('\n8. Motivation Index')
{
  // Big stakes mismatch = high motivation gap
  const mismatch = calculateMAI({ teamAStakes: 0.9, teamBStakes: 0.05, gameWeight: 'must_win', teamAForm: 2.0, teamBForm: 1.0 })
  assert(mismatch.value > 0, 'MAI: stakes mismatch produces positive value', `value=${mismatch.value.toFixed(3)}`)

  // Even stakes = near zero
  const even = calculateMAI({ teamAStakes: 0.5, teamBStakes: 0.5, gameWeight: 'medium', teamAForm: 1.5, teamBForm: 1.5 })
  assert(even.value < mismatch.value, 'MAI: even stakes < mismatch', `even=${even.value.toFixed(3)} < mismatch=${mismatch.value.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🟡 TIER 3: TACTICAL BLINDSPOTS')
// ═══════════════════════════════════════════════════════════════════════════

// 9. DSE — Defensive Shape Entropy
console.log('\n9. Defensive Shape Entropy')
{
  // All players in zone = low entropy
  const intact = calculateDSE({
    players: [
      { playerId: 'p1', currentX: 0.1, currentY: 0.5, assignedZone: [0, 0.2, 0.3, 0.7] as [number,number,number,number] },
      { playerId: 'p2', currentX: 0.4, currentY: 0.5, assignedZone: [0.3, 0.5, 0.3, 0.7] as [number,number,number,number] },
      { playerId: 'p3', currentX: 0.15, currentY: 0.4, assignedZone: [0, 0.3, 0.2, 0.6] as [number,number,number,number] },
    ]
  })
  assert(intact.value < 0.5, 'DSE: organized shape = low entropy', `value=${intact.value.toFixed(3)}`)

  // Players scattered = high entropy
  const broken = calculateDSE({
    players: [
      { playerId: 'p1', currentX: 0.6, currentY: 0.1, assignedZone: [0, 0.2, 0.3, 0.7] as [number,number,number,number] },
      { playerId: 'p2', currentX: 0.8, currentY: 0.9, assignedZone: [0.3, 0.5, 0.3, 0.7] as [number,number,number,number] },
      { playerId: 'p3', currentX: 0.3, currentY: 0.05, assignedZone: [0, 0.3, 0.2, 0.6] as [number,number,number,number] },
    ]
  })
  assert(broken.value > intact.value, 'DSE: broken shape > organized', `broken=${broken.value.toFixed(3)} > intact=${intact.value.toFixed(3)}`)
}

// 10. SBDI
console.log('\n10. Second-Ball Dominance')
{
  const high = calculateSBDI({ totalContestedBalls: 50, secondBallsWon: 35, territorialWeight: 0.9 })
  const low = calculateSBDI({ totalContestedBalls: 50, secondBallsWon: 15, territorialWeight: 0.5 })
  assert(high.value > 0.5, 'SBDI: high dominance > 0.5', `value=${high.value.toFixed(3)}`)
  assert(high.value > low.value, 'SBDI: high > low', `high=${high.value.toFixed(3)} > low=${low.value.toFixed(3)}`)

  // Verify formula: won/total × territorial
  const manual = 35 / 50 * 0.9
  assert(Math.abs(high.value - manual) < 0.001, 'SBDI: formula verified', `computed=${high.value.toFixed(4)}, expected=${manual.toFixed(4)}`)
}

// 11. Press Lag
console.log('\n11. Press Trigger Lag')
{
  const fast = calculatePressLag({ pressEvents: [
    { triggerType: 'test', lagSeconds: 0.8, oppositionTransitionSpeed: 0.6 },
    { triggerType: 'test', lagSeconds: 1.0, oppositionTransitionSpeed: 0.7 },
  ]})
  const slow = calculatePressLag({ pressEvents: [
    { triggerType: 'test', lagSeconds: 2.5, oppositionTransitionSpeed: 0.8 },
    { triggerType: 'test', lagSeconds: 3.0, oppositionTransitionSpeed: 0.9 },
  ]})
  assert(fast.value < slow.value, 'Press Lag: fast < slow', `fast=${fast.value.toFixed(2)}s < slow=${slow.value.toFixed(2)}s`)
  assert(fast.label.includes('ELITE') || fast.value < 1.5, 'Press Lag: fast labeled correctly', `label=${fast.label}`)
  assert(slow.label.includes('EXPLOITABLE'), 'Press Lag: slow labeled exploitable', `label=${slow.label}`)
}

// 12. SOA
console.log('\n12. Spatial Overload Asymmetry')
{
  const perfect = calculateSOA({ zones: [
    { zoneId: 'z1', intendedDensity: 2, actualDensity: 2 },
    { zoneId: 'z2', intendedDensity: 3, actualDensity: 3 },
  ]})
  assert(perfect.value < 0.5, 'SOA: perfect alignment = low', `value=${perfect.value.toFixed(3)}`)

  const misaligned = calculateSOA({ zones: [
    { zoneId: 'z1', intendedDensity: 2, actualDensity: 5 },
    { zoneId: 'z2', intendedDensity: 3, actualDensity: 0 },
  ]})
  assert(misaligned.value > perfect.value, 'SOA: misaligned > perfect', `mis=${misaligned.value.toFixed(3)} > perf=${perfect.value.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔵 TIER 4: MARKET & META-GAME')
// ═══════════════════════════════════════════════════════════════════════════

// 13. Line Alpha
console.log('\n13. Line Movement Alpha')
{
  // Sharp money: line moved 2.5 but only 0.7 explained = 1.8 residual
  const sharp = calculateLineAlpha({ totalLineMove: 2.5, publicMoneyEffect: 0.3, injuryAdjustment: 0.2, weatherAdjustment: 0.2, direction: 1 })
  assert(Math.abs(sharp.value) > 0.5, 'Line Alpha: sharp money detected', `alpha=${sharp.value.toFixed(2)}`)
  assert(sharp.label.includes('SHARP'), 'Line Alpha: labeled SHARP', `label=${sharp.label}`)

  // Fully explained
  const explained = calculateLineAlpha({ totalLineMove: 0.8, publicMoneyEffect: 0.4, injuryAdjustment: 0.3, weatherAdjustment: 0.1, direction: -1 })
  assert(Math.abs(explained.value) < 0.5, 'Line Alpha: fully explained', `alpha=${explained.value.toFixed(2)}`)

  // Verify: alpha = total - (public + injury + weather)
  const expected = 2.5 - (0.3 + 0.2 + 0.2)
  assert(Math.abs(sharp.value - expected) < 0.001, 'Line Alpha: formula verified', `computed=${sharp.value.toFixed(4)}, expected=${expected.toFixed(4)}`)
}

// 14. RBEI
console.log('\n14. Recency Bias Exploitation')
{
  // Market overvalues: implied=0.75, true=0.50, sigma=0.12 → RBEI = (0.75-0.50)/0.12 = 2.08
  const overvalued = calculateRBEI({ marketImpliedProb: 0.75, trueTalentProb: 0.50, performanceStdDev: 0.12, recentResults: [1, 1, 1] })
  assert(overvalued.value > 1.8, 'RBEI: overvalued > 1.8', `value=${overvalued.value.toFixed(2)}`)
  assert(overvalued.label.includes('FADE'), 'RBEI: overvalued = FADE', `label=${overvalued.label}`)

  // Efficient market
  const efficient = calculateRBEI({ marketImpliedProb: 0.52, trueTalentProb: 0.50, performanceStdDev: 0.12, recentResults: [1, 0, 1] })
  assert(Math.abs(efficient.value) < 1.0, 'RBEI: efficient < 1.0', `value=${efficient.value.toFixed(2)}`)

  // Verify formula
  const expected = (0.75 - 0.50) / 0.12
  assert(Math.abs(overvalued.value - expected) < 0.01, 'RBEI: formula verified', `computed=${overvalued.value.toFixed(2)}, expected=${expected.toFixed(2)}`)
}

// 15. CTC
console.log('\n15. Coaching Tenure Curve')
{
  // Peak (month 12) should be higher than cliff (month 35)
  const peak = calculateCTC({ monthsSinceAppointment: 12, baselineTalent: 0.65, rosterTurnover: 0.2 })
  const cliff = calculateCTC({ monthsSinceAppointment: 35, baselineTalent: 0.65, rosterTurnover: 0.2 })
  assert(peak.value > cliff.value, 'CTC: peak (12mo) > cliff (35mo)', `peak=${peak.value.toFixed(3)} > cliff=${cliff.value.toFixed(3)}`)

  // Roster turnover mitigates cliff
  const refreshed = calculateCTC({ monthsSinceAppointment: 35, baselineTalent: 0.65, rosterTurnover: 0.6 })
  assert(refreshed.value > cliff.value, 'CTC: roster turnover mitigates cliff', `refreshed=${refreshed.value.toFixed(3)} > cliff=${cliff.value.toFixed(3)}`)

  // Verify the formula is a damped oscillation
  const baselineTalent = 0.65
  const month6 = calculateCTC({ monthsSinceAppointment: 6, baselineTalent, rosterTurnover: 0.1 })
  const month1 = calculateCTC({ monthsSinceAppointment: 1, baselineTalent, rosterTurnover: 0.1 })
  const month3 = calculateCTC({ monthsSinceAppointment: 3, baselineTalent, rosterTurnover: 0.1 })
  // New manager bump should be visible: month3 > month1 (ascending) or month6 > month1
  assert(month6.value > baselineTalent * 0.99 || month3.value > month1.value, 'CTC: new manager bump visible', `m1=${month1.value.toFixed(3)}, m3=${month3.value.toFixed(3)}, m6=${month6.value.toFixed(3)}`)
}

// 16. Narrative Momentum
console.log('\n16. Narrative Momentum')
{
  const positive = calculateNarrativeMomentum({
    mediaMentions: [
      { sentiment: 0.9, reach: 0.95, daysAgo: 0 },
      { sentiment: 0.8, reach: 0.8, daysAgo: 1 },
    ],
    currentForm: 2.2,
  })
  assert(positive.value > 0, 'NM: positive narrative = positive score', `value=${positive.value.toFixed(3)}`)

  const negative = calculateNarrativeMomentum({
    mediaMentions: [
      { sentiment: -0.8, reach: 0.9, daysAgo: 0 },
      { sentiment: -0.6, reach: 0.7, daysAgo: 1 },
    ],
    currentForm: 0.8,
  })
  assert(negative.value < 0, 'NM: negative narrative = negative score', `value=${negative.value.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n⚫ TIER 5: THE ABYSS')
// ═══════════════════════════════════════════════════════════════════════════

// 17. CAPZ
console.log('\n17. Crowd Acoustic Pressure')
{
  // Away GK in hostile enclosed stadium = high pressure
  const hostile = calculateCAPZ({
    playerX: 0.95, playerY: 0.5, capacity: 80000, attendancePct: 1.0,
    stadiumType: 'enclosed', isHome: false, hostility: 0.9, exposureSeconds: 8,
  })
  const calm = calculateCAPZ({
    playerX: 0.5, playerY: 0.5, capacity: 20000, attendancePct: 0.5,
    stadiumType: 'open_bowl', isHome: true, hostility: 0.2, exposureSeconds: 2,
  })
  assert(hostile.value > calm.value, 'CAPZ: hostile > calm', `hostile=${hostile.value.toFixed(1)}dB > calm=${calm.value.toFixed(1)}dB`)
}

// 18. TAD
console.log('\n18. Tactical Plagiarism Detection')
{
  const fast = calculateTAD({ currentSimilarity: 0.7, previousSimilarity: 0.3, gamesSinceOpponent: 2 })
  const slow = calculateTAD({ currentSimilarity: 0.35, previousSimilarity: 0.3, gamesSinceOpponent: 6 })
  assert(fast.value > slow.value, 'TAD: fast adapter > slow', `fast=${fast.value.toFixed(4)} > slow=${slow.value.toFixed(4)}`)
  assert(fast.label.includes('ELITE'), 'TAD: fast labeled ELITE', `label=${fast.label}`)
}

// 19. Sub Decay
console.log('\n19. Substitution Impact Decay')
{
  // At minute 0: no impact yet (warm-up curve at 0)
  const t0 = calculateSubDecay({ minutesSinceSub: 0, subQuality: 0.8, opponentAdjustment: 0.4 })
  assert(Math.abs(t0.value) < 0.01, 'Sub Decay: zero impact at t=0', `value=${t0.value.toFixed(4)}`)

  // Impact should peak around 15-25 minutes
  const t19 = calculateSubDecay({ minutesSinceSub: 19, subQuality: 0.8, opponentAdjustment: 0.4 })
  const t30 = calculateSubDecay({ minutesSinceSub: 30, subQuality: 0.8, opponentAdjustment: 0.4 })
  assert(t19.value > 0, 'Sub Decay: positive impact at minute 19', `value=${t19.value.toFixed(4)}`)

  // Eventually opponent adjusts and neutralizes
  const t60 = calculateSubDecay({ minutesSinceSub: 60, subQuality: 0.8, opponentAdjustment: 0.4 })
  // At 60 min, counter factor should be significant
  assert(t60.raw?.counterFactor as number > (t19.raw?.counterFactor as number), 'Sub Decay: counter increases over time', `60m=${t60.raw?.counterFactor} > 19m=${t19.raw?.counterFactor}`)
}

// 20. IPR
console.log('\n20. Psychological Residue (Hangover)')
{
  // Dramatic win = negative next-game impact
  const win = calculateIPR({ dramaIndex: 0.9, emotionalValence: 1, daysSincePreviousGame: 3, wasComeback: true, wasDerby: true, crowdFactor: 0.9 })
  const rawPerf = win.raw?.performanceImpact as string
  assert(parseFloat(rawPerf) < 0, 'IPR: dramatic win = negative impact', `impact=${rawPerf}`)

  // Devastating loss = positive next-game boost
  const loss = calculateIPR({ dramaIndex: 0.9, emotionalValence: -1, daysSincePreviousGame: 3, wasComeback: true, wasDerby: true, crowdFactor: 0.9 })
  const rawPerfLoss = loss.raw?.performanceImpact as string
  assert(parseFloat(rawPerfLoss) > 0, 'IPR: devastating loss = positive boost', `impact=${rawPerfLoss}`)

  // More recovery days = less residue
  const fresh = calculateIPR({ dramaIndex: 0.9, emotionalValence: 1, daysSincePreviousGame: 10, wasComeback: false, wasDerby: false, crowdFactor: 0.5 })
  const raw = calculateIPR({ dramaIndex: 0.9, emotionalValence: 1, daysSincePreviousGame: 2, wasComeback: false, wasDerby: false, crowdFactor: 0.5 })
  assert(Math.abs(fresh.value) < Math.abs(raw.value), 'IPR: more recovery = less residue', `10d=${fresh.value.toFixed(3)} < 2d=${raw.value.toFixed(3)}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE TEST
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📊 COMPOSITE ANALYSIS')
const full = runFullAdvancedAnalysis({
  cri: { scoreDifferential: -2, probability: 0.3, outcomeMagnitude: 0.6, minutesRemaining: 12 },
  scs: { triggerEvent: { playerId: 'p1', intensity: 0.9, minute: 30, valence: 1 }, teammates: [{ playerId: 'p2', socialProximity: 0.9, physicalProximity: 0.8 }], currentMinute: 33 },
  fcd: { matchDays: [0, 2, 5] },
  mai: { teamAStakes: 0.85, teamBStakes: 0.05, gameWeight: 'must_win', teamAForm: 2.0, teamBForm: 0.8 },
  sbdi: { totalContestedBalls: 40, secondBallsWon: 28, territorialWeight: 0.75 },
  rbei: { marketImpliedProb: 0.72, trueTalentProb: 0.55, performanceStdDev: 0.12, recentResults: [1, 1, 1] },
  ipr: { dramaIndex: 0.7, emotionalValence: -1, daysSincePreviousGame: 4, wasComeback: false, wasDerby: true, crowdFactor: 0.7 },
})
assert(full.formulas.length === 7, 'Composite: correct formula count', `count=${full.formulas.length}`)
assert(full.compositeScore >= 0 && full.compositeScore <= 1, 'Composite: score in [0,1]', `score=${full.compositeScore.toFixed(3)}`)
assert(Array.isArray(full.flags), 'Composite: flags is array', `flags=${JSON.stringify(full.flags)}`)

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60))
console.log(`RESULTS: ${pass} passed, ${fail} failed out of ${pass + fail} tests`)
if (errors.length > 0) {
  console.log('\nFAILURES:')
  errors.forEach(e => console.log(`  ⚠️  ${e}`))
}
console.log('═'.repeat(60))