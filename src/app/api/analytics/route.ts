import { NextRequest, NextResponse } from 'next/server'
import {
  calculateActionXT, processMatchXTStream, processStatsBombPassesForXT,
  getXTGridForVisualization, type XTActionResult, type XTPlayerLeaderboard,
} from '@/lib/xt-engine'
import {
  computeSpatialDominance, getVoronoiForFrontend,
  type VoronoiResult,
} from '@/lib/voronoi-engine'
import {
  tagEventsWithGameState, aggregateByGameState, computeGameStateComparison,
  type GameState, type TaggedEvent,
} from '@/lib/game-state-engine'
import { fetchEvents, extractShots, extractPasses } from '@/lib/statsbomb'

/**
 * GET /api/analytics
 * Unified deep analytics endpoint — the "secret sauce" engine.
 *
 * Actions:
 *   xt-calculate    — Calculate xT for a single action
 *   xt-grid         — Get the 12x8 xT heatmap grid
 *   xt-match        — Process an entire StatsBomb match's pass stream
 *   xt-leaderboard  — xT leaderboard for a StatsBomb match
 *   voronoi         — Spatial dominance from provided coordinates
 *   voronoi-demo    — Demo: 2022 WC Final freeze-frame positions
 *   game-state      — Tag events with WINNING/DRAWING/LOSING
 *   game-state-match — Full game-state analysis for a StatsBomb match
 *   full-analysis   — Run all engines on a StatsBomb match
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'xt-grid'

    switch (action) {
      // ════════════════════════════════════════════════════════════════════
      // EXPECTED THREAT (xT)
      // ════════════════════════════════════════════════════════════════════

      case 'xt-calculate': {
        const sx = parseFloat(searchParams.get('sx') || '0')
        const sy = parseFloat(searchParams.get('sy') || '0')
        const ex = parseFloat(searchParams.get('ex') || '0')
        const ey = parseFloat(searchParams.get('ey') || '0')
        const pct = searchParams.get('pct') === 'true'

        const result = calculateActionXT(sx, sy, ex, ey, 105, 68, pct)
        return NextResponse.json({ success: true, action, data: result })
      }

      case 'xt-grid': {
        const grid = getXTGridForVisualization()
        return NextResponse.json({
          success: true,
          action,
          gridRows: 8,
          gridCols: 12,
          count: grid.length,
          data: grid,
        })
      }

      case 'xt-match': {
        const matchId = parseInt(searchParams.get('match') || '3869151')
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found in StatsBomb' }, { status: 404 })
        }

        const { enriched, leaderboard } = processStatsBombPassesForXT(events as any)
        return NextResponse.json({
          success: true,
          action,
          matchId,
          totalPasses: enriched.length,
          data: { events: enriched, leaderboard },
        })
      }

      case 'xt-leaderboard': {
        const matchId = parseInt(searchParams.get('match') || '3869151')
        const limit = parseInt(searchParams.get('limit') || '20')
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
        }

        const { leaderboard } = processStatsBombPassesForXT(events as any)
        return NextResponse.json({
          success: true,
          action,
          matchId,
          count: leaderboard.length,
          data: leaderboard.slice(0, limit),
        })
      }

      // ════════════════════════════════════════════════════════════════════
      // VORONOI SPATIAL DOMINANCE
      // ════════════════════════════════════════════════════════════════════

      case 'voronoi': {
        const homeJson = searchParams.get('home')
        const awayJson = searchParams.get('away')
        const pitchL = parseFloat(searchParams.get('pitchLength') || '105')
        const pitchW = parseFloat(searchParams.get('pitchWidth') || '68')

        if (!homeJson || !awayJson) {
          return NextResponse.json({
            success: false,
            error: 'Provide ?home= and ?away= as JSON arrays of {x,y} objects',
            example: '?home=[{"x":15,"y":34},{"x":30,"y":15}]&away=[{"x":90,"y":34}]',
          }, { status: 400 })
        }

        const home = JSON.parse(homeJson)
        const away = JSON.parse(awayJson)

        const result = computeSpatialDominance(home, away, pitchL, pitchW)
        const frontend = getVoronoiForFrontend(result)

        return NextResponse.json({
          success: true,
          action,
          pitchArea: result.totalPitchArea,
          homeDominance: result.home.totalDominancePct + '%',
          awayDominance: result.away.totalDominancePct + '%',
          data: {
            summary: {
              home: result.home,
              away: result.away,
            },
            players: result.players,
            frontend,  // Pre-normalized for canvas/SVG rendering
          },
        })
      }

      case 'voronoi-demo': {
        // 2022 World Cup Final approximate starting positions
        const home = [
          { x: 10, y: 34, player: 'Martinez' },
          { x: 25, y: 10, player: 'Molina' },
          { x: 22, y: 34, player: 'Romero' },
          { x: 22, y: 54, player: 'Otamendi' },
          { x: 25, y: 60, player: 'Tagliafico' },
          { x: 38, y: 20, player: 'De Paul' },
          { x: 35, y: 42, player: 'Enzo Fernandez' },
          { x: 38, y: 56, player: 'Mac Allister' },
          { x: 50, y: 15, player: 'Molina' },
          { x: 55, y: 34, player: 'Alvarez' },
          { x: 55, y: 54, player: 'Messi' },
        ]
        const away = [
          { x: 110, y: 34, player: 'Lloris' },
          { x: 95, y: 10, player: 'Kounde' },
          { x: 93, y: 34, player: 'Varane' },
          { x: 93, y: 54, player: 'Hernandez' },
          { x: 95, y: 60, player: 'Tchouameni' },
          { x: 78, y: 18, player: 'Griezmann' },
          { x: 75, y: 42, player: 'Rabiot' },
          { x: 78, y: 56, player: 'Dembele' },
          { x: 65, y: 15, player: 'Mbappe' },
          { x: 60, y: 54, player: 'Giroud' },
          { x: 60, y: 34, player: 'Tchouameni' },
        ]

        const result = computeSpatialDominance(home, away, 120, 80) // SB pitch: 120x80
        const frontend = getVoronoiForFrontend(result)

        return NextResponse.json({
          success: true,
          action,
          source: 'Demo: 2022 WC Final approximate starting XI',
          pitchDimensions: `${result.pitchLength}m × ${result.pitchWidth}m`,
          homeDominance: result.home.totalDominancePct + '%',
          awayDominance: result.away.totalDominancePct + '%',
          data: {
            summary: {
              home: result.home,
              away: result.away,
            },
            players: result.players,
            frontend,
          },
        })
      }

      // ════════════════════════════════════════════════════════════════════
      // GAME-STATE ANALYSIS
      // ════════════════════════════════════════════════════════════════════

      case 'game-state': {
        const eventsJson = searchParams.get('events')
        const homeTeam = searchParams.get('homeTeam') || 'Home'
        const awayTeam = searchParams.get('awayTeam') || 'Away'
        const goalsJson = searchParams.get('goals')

        if (!eventsJson) {
          return NextResponse.json({
            success: false,
            error: 'Provide ?events= as JSON array of {minute, team, actionType, ...}',
            example: '?events=[{"minute":10,"team":"Home","actionType":"Pass"}]&homeTeam=Argentina&goals=[{"minute":23,"team":"Home"}]',
          }, { status: 400 })
        }

        const events = JSON.parse(eventsJson)
        const goals = goalsJson ? JSON.parse(goalsJson) : []

        const comparison = computeGameStateComparison(events, homeTeam, awayTeam, goals)
        return NextResponse.json({ success: true, action, data: comparison })
      }

      case 'game-state-match': {
        const matchId = parseInt(searchParams.get('match') || '3869151')
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
        }

        const teams = [...new Set(events.map((e: any) => e.team?.name).filter(Boolean))]
        const homeTeam = teams[0] || 'Home'
        const awayTeam = teams[1] || 'Away'

        // Extract goals for score timeline
        const goals = events
          .filter((e: any) => e.type?.name === 'Shot' && e.shot?.outcome?.name === 'Goal')
          .map((e: any) => ({ minute: e.minute, team: e.team?.name }))

        // Extract pass and shot events for game-state analysis
        const matchEvents = events
          .filter((e: any) => e.type?.name === 'Pass' || e.type?.name === 'Shot')
          .map((e: any) => ({
            minute: e.minute,
            team: e.team?.name || '',
            actionType: e.type?.name,
            player: e.player?.name || '',
            startX: e.location?.[0],
            startY: e.location?.[1],
            endX: e.pass?.end_location?.[0] || e.shot?.end_location?.[0],
            endY: e.pass?.end_location?.[1] || e.shot?.end_location?.[1],
          }))

        // Tag with game state
        const tagged = tagEventsWithGameState(matchEvents, homeTeam, goals)

        // Also compute xT for passes
        const { enriched: xtEnriched, leaderboard: xtLeaderboard } = processStatsBombPassesForXT(events as any)

        // Merge xT data into tagged events (by minute + player match)
        const xtMap = new Map<string, number>()
        for (const xt of xtEnriched) {
          const key = `${xt.minute}-${xt.player}`
          xtMap.set(key, xt.xtGained)
        }

        const taggedWithXT = tagged.map(e => ({
          ...e,
          xtGained: xtMap.get(`${e.minute}-${e.player}`) || 0,
        }))

        // Aggregate by game state
        const aggregates = aggregateByGameState(taggedWithXT)

        return NextResponse.json({
          success: true,
          action,
          matchId,
          homeTeam,
          awayTeam,
          goals,
          totalEvents: taggedWithXT.length,
          data: {
            aggregates,
            xtLeaderboard: xtLeaderboard.slice(0, 15),
          },
        })
      }

      // ════════════════════════════════════════════════════════════════════
      // FULL ANALYSIS — ALL ENGINES AT ONCE
      // ════════════════════════════════════════════════════════════════════

      case 'full-analysis': {
        const matchId = parseInt(searchParams.get('match') || '3869151')
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
        }

        const teams = [...new Set(events.map((e: any) => e.team?.name).filter(Boolean))]
        const homeTeam = teams[0] || 'Home'
        const awayTeam = teams[1] || 'Away'

        // 1. Shots + xG
        const shots = extractShots(events)

        // 2. xT analysis
        const { enriched: xtEnriched, leaderboard: xtLeaderboard } = processStatsBombPassesForXT(events as any)

        // 3. Game-state analysis
        const goals = events
          .filter((e: any) => e.type?.name === 'Shot' && e.shot?.outcome?.name === 'Goal')
          .map((e: any) => ({ minute: e.minute, team: e.team?.name }))

        const matchEvents = events
          .filter((e: any) => e.type?.name === 'Pass' || e.type?.name === 'Shot')
          .map((e: any) => ({
            minute: e.minute,
            team: e.team?.name || '',
            actionType: e.type?.name,
            player: e.player?.name || '',
            startX: e.location?.[0],
            startY: e.location?.[1],
            endX: e.pass?.end_location?.[0] || e.shot?.end_location?.[0],
            endY: e.pass?.end_location?.[1] || e.shot?.end_location?.[1],
          }))

        const tagged = tagEventsWithGameState(matchEvents, homeTeam, goals)
        const xtMap = new Map<string, number>()
        for (const xt of xtEnriched) xtMap.set(`${xt.minute}-${xt.player}`, xt.xtGained)
        const taggedWithXT = tagged.map(e => ({ ...e, xtGained: xtMap.get(`${e.minute}-${e.player}`) || 0 }))
        const gameStateAgg = aggregateByGameState(taggedWithXT)

        return NextResponse.json({
          success: true,
          action,
          matchId,
          homeTeam,
          awayTeam,
          score: `${goals.filter(g => g.team === homeTeam).length} - ${goals.filter(g => g.team === awayTeam).length}`,
          data: {
            shots: {
              total: shots.length,
              homeXg: +shots.filter(s => s.team === homeTeam).reduce((sum, s) => sum + s.xg, 0).toFixed(2),
              awayXg: +shots.filter(s => s.team === awayTeam).reduce((sum, s) => sum + s.xg, 0).toFixed(2),
            },
            xT: {
              totalPassesProcessed: xtEnriched.length,
              leaderboard: xtLeaderboard.slice(0, 10),
            },
            gameState: gameStateAgg,
            xTGrid: getXTGridForVisualization(120, 80),
          },
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          validActions: [
            'xt-calculate', 'xt-grid', 'xt-match', 'xt-leaderboard',
            'voronoi', 'voronoi-demo',
            'game-state', 'game-state-match',
            'full-analysis',
          ],
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}