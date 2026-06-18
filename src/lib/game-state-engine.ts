/**
 * ELASTICO — Game-State Tagging Engine
 *
 * Every event in a match is tagged with the psychological context:
 *   WINNING  — the acting team is ahead
 *   DRAWING  — scores are level
 *   LOSING   — the acting team is behind
 *
 * Why this matters:
 *   A team winning 3-0 stops pressing and conserves energy.
 *   A team losing 0-1 attacks frantically and takes more risks.
 *   Splitting stats by game state reveals hidden tactical patterns:
 *     "When losing, Team X shifts 65% of attacks to the left flank."
 *
 * The engine also provides:
 *   - Score-differential buckets (-2+, -1, 0, +1, +2+)
 *   - Half splits (1st half vs 2nd half)
 *   - Aggregate comparisons (WINNING vs DRAWING vs LOSING)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type GameState = 'WINNING' | 'DRAWING' | 'LOSING'

export type ScoreDifferential = '-2+' | '-1' | '0' | '+1' | '+2+'

export type Half = '1st' | '2nd'

export interface GameEvent {
  minute: number
  team: string
  actionType?: string
  player?: string
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  xtGained?: number
  [key: string]: any  // allow extra fields
}

export interface TaggedEvent extends GameEvent {
  homeScore: number
  awayScore: number
  scoreDifferential: number
  gameState: GameState
  scoreBucket: ScoreDifferential
  half: Half
  isHomeTeam: boolean
}

export interface GameStateAggregate {
  gameState: GameState
  totalEvents: number
  passes: number
  shots: number
  tackles: number
  avgXTPerPass: number
  totalXTGained: number
  progressivePasses: number  // xtGained > 0
  regressions: number       // xtGained < 0
  possessionPct: number
}

export interface GameStateComparison {
  homeTeam: string
  awayTeam: string
  states: Record<GameState, GameStateAggregate>
  totalEvents: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the game state from the perspective of the acting team.
 */
export function getGameState(
  eventTeam: string,
  homeTeam: string,
  homeScore: number,
  awayScore: number
): GameState {
  const isHome = eventTeam === homeTeam
  const myScore = isHome ? homeScore : awayScore
  const oppScore = isHome ? awayScore : homeScore

  if (myScore > oppScore) return 'WINNING'
  if (myScore < oppScore) return 'LOSING'
  return 'DRAWING'
}

/**
 * Classify score differential into buckets.
 */
export function getScoreBucket(differential: number): ScoreDifferential {
  if (differential <= -2) return '-2+'
  if (differential === -1) return '-1'
  if (differential === 0) return '0'
  if (differential === 1) return '+1'
  return '+2+'
}

/**
 * Determine which half of the match.
 */
export function getHalf(minute: number): Half {
  return minute <= 45 ? '1st' : '2nd'
}

/**
 * Build a live score timeline from goal events.
 * Returns a function that gives the score at any minute.
 */
export function buildScoreTimeline(
  homeTeam: string,
  goalEvents: Array<{ minute: number; team: string }>
): (minute: number) => { home: number; away: number } {
  // Sort goals by minute
  const sorted = [...goalEvents].sort((a, b) => a.minute - b.minute)
  let homeGoals = 0
  let awayGoals = 0
  const timeline: Array<{ minute: number; home: number; away: number }> = [{ minute: 0, home: 0, away: 0 }]

  for (const goal of sorted) {
    if (goal.team === homeTeam) homeGoals++
    else awayGoals++
    timeline.push({ minute: goal.minute, home: homeGoals, away: awayGoals })
  }

  return (minute: number): { home: number; away: number } => {
    // Find the last score entry at or before this minute
    let score = timeline[0]
    for (const entry of timeline) {
      if (entry.minute <= minute) score = entry
      else break
    }
    return { home: score.home, away: score.away }
  }
}

/**
 * Tag every event in a match stream with its game-state context.
 *
 * @param events     - Raw match events (any shape, must have: minute, team)
 * @param homeTeam   - Name of the home team
 * @param goalEvents - Array of goal events with { minute, team } for score tracking
 */
export function tagEventsWithGameState<T extends GameEvent>(
  events: T[],
  homeTeam: string,
  goalEvents: Array<{ minute: number; team: string }>
): TaggedEvent[] {
  const getScore = buildScoreTimeline(homeTeam, goalEvents)

  return events.map(event => {
    const score = getScore(event.minute)
    const isHomeTeam = event.team === homeTeam
    const myScore = isHomeTeam ? score.home : score.away
    const oppScore = isHomeTeam ? score.away : score.home
    const diff = myScore - oppScore

    return {
      ...event,
      homeScore: score.home,
      awayScore: score.away,
      scoreDifferential: diff,
      gameState: getGameState(event.team, homeTeam, score.home, score.away),
      scoreBucket: getScoreBucket(diff),
      half: getHalf(event.minute),
      isHomeTeam,
    }
  })
}

/**
 * Aggregate tagged events by game state.
 * Returns stats for WINNING, DRAWING, LOSING.
 */
export function aggregateByGameState(taggedEvents: TaggedEvent[]): GameStateAggregate[] {
  const buckets: Record<string, TaggedEvent[]> = {
    WINNING: [],
    DRAWING: [],
    LOSING: [],
  }

  for (const e of taggedEvents) {
    if (buckets[e.gameState]) {
      buckets[e.gameState].push(e)
    }
  }

  const totalEvents = taggedEvents.length

  return (['WINNING', 'DRAWING', 'LOSING'] as GameState[]).map(state => {
    const events = buckets[state]
    const passes = events.filter(e => e.actionType === 'Pass' || e.actionType === 'pass')
    const shots = events.filter(e => e.actionType === 'Shot' || e.actionType === 'shot')
    const tackles = events.filter(e => e.actionType === 'Tackle' || e.actionType === 'tackle' || e.actionType === 'Duel')

    const totalXT = passes.reduce((sum, e) => sum + (e.xtGained || 0), 0)
    const progressive = passes.filter(e => (e.xtGained || 0) > 0).length
    const regressions = passes.filter(e => (e.xtGained || 0) < 0).length

    return {
      gameState: state,
      totalEvents: events.length,
      passes: passes.length,
      shots: shots.length,
      tackles: tackles.length,
      avgXTPerPass: passes.length > 0 ? +(totalXT / passes.length).toFixed(5) : 0,
      totalXTGained: +totalXT.toFixed(4),
      progressivePasses: progressive,
      regressions: regressions,
      possessionPct: totalEvents > 0 ? +((events.length / totalEvents) * 100).toFixed(1) : 0,
    }
  })
}

/**
 * Full pipeline: takes raw events + goals, outputs a complete game-state comparison.
 */
export function computeGameStateComparison(
  events: GameEvent[],
  homeTeam: string,
  awayTeam: string,
  goalEvents: Array<{ minute: number; team: string }>
): GameStateComparison {
  const tagged = tagEventsWithGameState(events, homeTeam, goalEvents)
  const states = aggregateByGameState(tagged)

  const stateMap: Record<GameState, GameStateAggregate> = {} as any
  for (const s of states) {
    stateMap[s.gameState] = s
  }

  return {
    homeTeam,
    awayTeam,
    states: stateMap,
    totalEvents: tagged.length,
  }
}