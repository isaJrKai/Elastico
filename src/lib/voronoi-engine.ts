/**
 * ELASTICO — Voronoi Spatial Dominance Engine
 *
 * Calculates how much of the pitch each player controls using Voronoi tessellation.
 * The pitch is divided into polygonal regions — each point inside a player's polygon
 * is closer to that player than any other.
 *
 * Uses d3-delaunay for high-performance Voronoi computation in pure TypeScript.
 * No Python/scipy/shapely needed — this runs natively in Node.js.
 *
 * Output includes:
 *   - Per-player space controlled (sq meters and % of pitch)
 *   - Polygon vertices for frontend canvas/SVG rendering
 *   - Team aggregate dominance metrics
 */

import { Delaunay } from 'd3-delaunay'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlayerCoordinate {
  x: number       // meters
  y: number       // meters
  team: 'home' | 'away'
  player?: string
  playerIndex?: number
  jerseyNumber?: number
}

export interface PlayerDominance {
  playerIndex: number
  team: 'home' | 'away'
  player: string
  coordinates: { x: number; y: number }
  spaceControlledSqm: number
  spaceDominancePct: number
  polygon: Array<[number, number]>  // clipped vertices
}

export interface TeamDominance {
  team: 'home' | 'away'
  totalSpaceSqm: number
  totalDominancePct: number
  players: PlayerDominance[]
}

export interface VoronoiResult {
  pitchLength: number
  pitchWidth: number
  totalPitchArea: number
  home: TeamDominance
  away: TeamDominance
  players: PlayerDominance[]
  // Flat array for frontend canvas rendering: [x1,y1, x2,y2, ...] per player polygon
  polygonsFlat: Array<{ team: 'home' | 'away'; points: Array<[number, number]> }>
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the area of a simple polygon using the Shoelace formula.
 * Handles both CW and CCW vertex ordering.
 */
function polygonArea(vertices: Array<[number, number]>): number {
  const n = vertices.length
  if (n < 3) return 0
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i][0] * vertices[j][1]
    area -= vertices[j][0] * vertices[i][1]
  }
  return Math.abs(area) / 2
}

/**
 * Sutherland-Hodgman algorithm: clip a polygon to a rectangular boundary.
 * This is the TypeScript equivalent of shapely's polygon.intersection(Rectangle).
 */
function clipPolygonToRect(
  polygon: Array<[number, number]>,
  minX: number, minY: number, maxX: number, maxY: number
): Array<[number, number]> {
  let output = [...polygon]
  const edges: Array<{ inside: (p: [number, number]) => boolean; intersect: (a: [number, number], b: [number, number]) => [number, number] }> = [
    { inside: p => p[0] >= minX, intersect: (a, b) => lineIntersectX(a, b, minX) },
    { inside: p => p[0] <= maxX, intersect: (a, b) => lineIntersectX(a, b, maxX) },
    { inside: p => p[1] >= minY, intersect: (a, b) => lineIntersectY(a, b, minY) },
    { inside: p => p[1] <= maxY, intersect: (a, b) => lineIntersectY(a, b, maxY) },
  ]

  for (const edge of edges) {
    if (output.length === 0) return []
    const input = output
    output = []
    for (let i = 0; i < input.length; i++) {
      const current = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      const currInside = edge.inside(current)
      const prevInside = edge.inside(prev)

      if (currInside) {
        if (!prevInside) output.push(edge.intersect(prev, current))
        output.push(current)
      } else if (prevInside) {
        output.push(edge.intersect(prev, current))
      }
    }
  }
  return output
}

function lineIntersectX(a: [number, number], b: [number, number], x: number): [number, number] {
  if (Math.abs(b[0] - a[0]) < 1e-10) return [x, a[1]]
  const t = (x - a[0]) / (b[0] - a[0])
  return [x, a[1] + t * (b[1] - a[1])]
}

function lineIntersectY(a: [number, number], b: [number, number], y: number): [number, number] {
  if (Math.abs(b[1] - a[1]) < 1e-10) return [a[0], y]
  const t = (y - a[1]) / (b[1] - a[1])
  return [a[0] + t * (b[0] - a[0]), y]
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute Voronoi spatial dominance for all players on the pitch.
 *
 * @param homePlayers  - Array of {x, y} coordinates for home team (in meters)
 * @param awayPlayers  - Array of {x, y} coordinates for away team (in meters)
 * @param pitchLength  - Standard: 105m
 * @param pitchWidth   - Standard: 68m
 * @param padding      - Extra padding outside pitch to ensure edge regions are finite (default: 30m)
 */
export function computeSpatialDominance(
  homePlayers: Array<{ x: number; y: number; player?: string; jerseyNumber?: number }>,
  awayPlayers: Array<{ x: number; y: number; player?: string; jerseyNumber?: number }>,
  pitchLength = 105.0,
  pitchWidth = 68.0,
  padding = 30
): VoronoiResult {
  const totalPitchArea = pitchLength * pitchWidth

  // 1. Build coordinate arrays with team labels
  const allPlayers: PlayerCoordinate[] = [
    ...homePlayers.map((p, i) => ({ ...p, team: 'home' as const, playerIndex: i, player: p.player || `Home ${i + 1}` })),
    ...awayPlayers.map((p, i) => ({ ...p, team: 'away' as const, playerIndex: i, player: p.player || `Away ${i + 1}` })),
  ]
  const n = allPlayers.length

  // 2. Add dummy mirror points far outside the pitch boundary
  // This forces all Voronoi regions to be finite (clippable)
  const margin = padding
  const dummyPoints: Array<[number, number]> = [
    [-margin, -margin],
    [pitchLength / 2, -margin],
    [pitchLength + margin, -margin],
    [pitchLength + margin, pitchWidth / 2],
    [pitchLength + margin, pitchWidth + margin],
    [pitchLength / 2, pitchWidth + margin],
    [-margin, pitchWidth + margin],
    [-margin, pitchWidth / 2],
  ]

  // 3. Flatten into point arrays for d3-delaunay
  const allPoints: Array<[number, number]> = [
    ...allPlayers.map(p => [p.x, p.y] as [number, number]),
    ...dummyPoints,
  ]
  const flat = allPoints.flatMap(p => p)

  // 4. Compute Delaunay triangulation → Voronoi diagram
  const delaunay = Delaunay.from(allPoints)
  const voronoi = delaunay.voronoi([
    -margin, -margin,
    pitchLength + margin, pitchWidth + margin,
  ])

  // 5. Process each player's Voronoi cell
  const players: PlayerDominance[] = []
  const homeDominance: PlayerDominance[] = []
  const awayDominance: PlayerDominance[] = []

  for (let i = 0; i < n; i++) {
    const cell = voronoi.cellPolygon(i)
    if (!cell) continue

    // Convert to [x,y] tuples
    const rawPolygon: Array<[number, number]> = cell.map(p => [p[0], p[1]])

    // Clip to pitch boundaries using Sutherland-Hodgman
    const clipped = clipPolygonToRect(rawPolygon, 0, 0, pitchLength, pitchWidth)

    if (clipped.length < 3) {
      // Degenerate polygon — player is outside or on the edge
      players.push({
        playerIndex: i,
        team: allPlayers[i].team,
        player: allPlayers[i].player || '',
        coordinates: { x: allPlayers[i].x, y: allPlayers[i].y },
        spaceControlledSqm: 0,
        spaceDominancePct: 0,
        polygon: [],
      })
      continue
    }

    const area = polygonArea(clipped)
    const pct = (area / totalPitchArea) * 100

    const dominance: PlayerDominance = {
      playerIndex: i,
      team: allPlayers[i].team,
      player: allPlayers[i].player || '',
      coordinates: { x: allPlayers[i].x, y: allPlayers[i].y },
      spaceControlledSqm: +area.toFixed(2),
      spaceDominancePct: +pct.toFixed(2),
      polygon: clipped,
    }

    players.push(dominance)
    if (allPlayers[i].team === 'home') homeDominance.push(dominance)
    else awayDominance.push(dominance)
  }

  // 6. Team aggregates
  const homeTotalSqm = homeDominance.reduce((sum, p) => sum + p.spaceControlledSqm, 0)
  const awayTotalSqm = awayDominance.reduce((sum, p) => sum + p.spaceControlledSqm, 0)

  return {
    pitchLength,
    pitchWidth,
    totalPitchArea,
    home: {
      team: 'home',
      totalSpaceSqm: +homeTotalSqm.toFixed(2),
      totalDominancePct: +((homeTotalSqm / totalPitchArea) * 100).toFixed(2),
      players: homeDominance,
    },
    away: {
      team: 'away',
      totalSpaceSqm: +awayTotalSqm.toFixed(2),
      totalDominancePct: +((awayTotalSqm / totalPitchArea) * 100).toFixed(2),
      players: awayDominance,
    },
    players,
    polygonsFlat: players.map(p => ({
      team: p.team,
      points: p.polygon,
    })),
  }
}

/**
 * Compute dominance from StatsBomb-format events (0-120 x 0-80 coordinates).
 * Extracts player positions from a specific timestamp/event freeze frame.
 */
export function computeDominanceFromStatsBomb(
  homePositions: Array<{ x: number; y: number; player?: string }>,
  awayPositions: Array<{ x: number; y: number; player?: string }>
): VoronoiResult {
  // StatsBomb pitch: 120m x 80m
  return computeSpatialDominance(homePositions, awayPositions, 120, 80)
}

/**
 * Generate a Voronoi payload suitable for SVG/Canvas rendering on the frontend.
 * Returns polygon vertices normalized to percentages (0-100) for CSS positioning.
 */
export function getVoronoiForFrontend(
  result: VoronoiResult
): Array<{
  team: 'home' | 'away'
  player: string
  playerX: number  // percentage
  playerY: number  // percentage
  polygon: Array<[number, number]>  // percentage coordinates
  areaSqm: number
  dominancePct: number
}> {
  return result.players.map(p => ({
    team: p.team,
    player: p.player,
    playerX: (p.coordinates.x / result.pitchLength) * 100,
    playerY: (p.coordinates.y / result.pitchWidth) * 100,
    polygon: p.polygon.map(([x, y]) => [
      (x / result.pitchLength) * 100,
      (y / result.pitchWidth) * 100,
    ]),
    areaSqm: p.spaceControlledSqm,
    dominancePct: p.spaceDominancePct,
  }))
}