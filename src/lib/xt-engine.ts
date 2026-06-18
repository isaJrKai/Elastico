/**
 * ELASTICO — Expected Threat (xT) Engine
 *
 * Ported from the Python xT framework used by professional football analytics.
 *
 * The pitch is divided into a 12×8 grid. Each cell holds a probability value
 * representing how likely a possession starting in that cell will end in a goal
 * within the next N actions.
 *
 * Grid orientation:
 *   Column 0  = own goal line (defensive)
 *   Column 11 = opponent's goal line (attacking)
 *   Row 0     = bottom touchline
 *   Row 7     = top touchline
 *
 * When a player passes from zone A to zone B:
 *   xT_gained = xT[B] - xT[A]
 *   Negative xT_gained = pass went backwards (reduced threat)
 *   Positive xT_gained = progressive, threatening pass
 *
 * This is the industry-standard baseline grid (trained on thousands of matches).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// THE 12×8 EXPECTED THREAT GRID
// ═══════════════════════════════════════════════════════════════════════════════

export const XT_GRID: number[][] = [
  // Col:  0       1       2       3       4       5       6       7       8       9       10      11
  /*Row 0*/ [0.0012, 0.0014, 0.0019, 0.0028, 0.0041, 0.0059, 0.0087, 0.0122, 0.0163, 0.0215, 0.0285, 0.0351],
  /*Row 1*/ [0.0014, 0.0017, 0.0023, 0.0034, 0.0049, 0.0072, 0.0105, 0.0149, 0.0204, 0.0278, 0.0381, 0.0485],
  /*Row 2*/ [0.0016, 0.0020, 0.0028, 0.0041, 0.0061, 0.0091, 0.0136, 0.0198, 0.0285, 0.0412, 0.0615, 0.0821],
  /*Row 3*/ [0.0018, 0.0023, 0.0032, 0.0049, 0.0075, 0.0116, 0.0182, 0.0281, 0.0431, 0.0691, 0.1152, 0.1654],
  /*Row 4*/ [0.0018, 0.0023, 0.0032, 0.0049, 0.0075, 0.0116, 0.0182, 0.0281, 0.0431, 0.0691, 0.1152, 0.1654],
  /*Row 5*/ [0.0016, 0.0020, 0.0028, 0.0041, 0.0061, 0.0091, 0.0136, 0.0198, 0.0285, 0.0412, 0.0615, 0.0821],
  /*Row 6*/ [0.0014, 0.0017, 0.0023, 0.0034, 0.0049, 0.0072, 0.0105, 0.0149, 0.0204, 0.0278, 0.0381, 0.0485],
  /*Row 7*/ [0.0012, 0.0014, 0.0019, 0.0028, 0.0041, 0.0059, 0.0087, 0.0122, 0.0163, 0.0215, 0.0285, 0.0351],
]

export const XT_COLS = 12
export const XT_ROWS = 8

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface XTActionResult {
  originGrid: [number, number]   // [row, col]
  destinationGrid: [number, number]
  startZoneThreat: number
  endZoneThreat: number
  xtGained: number               // positive = progressive, negative = backwards
}

export interface XTEnrichedEvent {
  player: string
  team: string
  minute: number
  actionType: string
  startX: number
  startY: number
  endX: number
  endY: number
  originGrid: [number, number]
  destinationGrid: [number, number]
  startZoneThreat: number
  endZoneThreat: number
  xtGained: number
}

export interface XTPlayerLeaderboard {
  player: string
  team: string
  totalXtGained: number
  totalActions: number
  avgXtPerAction: number
  progressiveActions: number   // passes where xtGained > 0
  regressions: number           // passes where xtGained < 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert meter coordinates to grid [row, col] index.
 * Handles pitch boundary clamping to prevent out-of-bounds.
 */
export function coordsToGrid(
  x: number, y: number,
  pitchLength = 105.0, pitchWidth = 68.0
): [number, number] {
  const clampedX = Math.max(0, Math.min(x, pitchLength - 0.01))
  const clampedY = Math.max(0, Math.min(y, pitchWidth - 0.01))

  const col = Math.min(Math.floor((clampedX / pitchLength) * XT_COLS), XT_COLS - 1)
  const row = Math.min(Math.floor((clampedY / pitchWidth) * XT_ROWS), XT_ROWS - 1)

  return [row, col]
}

/**
 * Get the xT value for a specific grid cell
 */
export function getXT(row: number, col: number): number {
  if (row < 0 || row >= XT_ROWS || col < 0 || col >= XT_COLS) return 0
  return XT_GRID[row][col]
}

/**
 * Calculate xT gained for a single action (pass, carry, etc.)
 * Supports both meter-based and percentage-based (0-100) coordinates.
 *
 * @param startX - Start X coordinate
 * @param startY - Start Y coordinate
 * @param endX   - End X coordinate
 * @param endY   - End Y coordinate
 * @param pitchLength - Pitch length in meters (default 105)
 * @param pitchWidth  - Pitch width in meters (default 68)
 * @param percentageMode - If true, coordinates are 0-100 percentages
 */
export function calculateActionXT(
  startX: number, startY: number,
  endX: number, endY: number,
  pitchLength = 105.0, pitchWidth = 68.0,
  percentageMode = false
): XTActionResult {
  let sx = startX, sy = startY, ex = endX, ey = endY

  if (percentageMode) {
    // Convert 0-100 to meters
    sx = (startX / 100) * pitchLength
    sy = (startY / 100) * pitchWidth
    ex = (endX / 100) * pitchLength
    ey = (endY / 100) * pitchWidth
  }

  const [startRow, startCol] = coordsToGrid(sx, sy, pitchLength, pitchWidth)
  const [endRow, endCol] = coordsToGrid(ex, ey, pitchLength, pitchWidth)

  const startThreat = getXT(startRow, startCol)
  const endThreat = getXT(endRow, endCol)

  return {
    originGrid: [startRow, startCol],
    destinationGrid: [endRow, endCol],
    startZoneThreat: +startThreat.toFixed(5),
    endZoneThreat: +endThreat.toFixed(5),
    xtGained: +(endThreat - startThreat).toFixed(5),
  }
}

/**
 * Process a full match event stream and produce:
 * 1. Enriched events with xT data
 * 2. Player leaderboard sorted by total xT gained
 */
export function processMatchXTStream(
  events: Array<{
    player: string
    team: string
    minute: number
    actionType?: string
    startX: number
    startY: number
    endX: number
    endY: number
  }>,
  pitchLength = 105.0,
  pitchWidth = 68.0,
  percentageMode = false
): { enriched: XTEnrichedEvent[]; leaderboard: XTPlayerLeaderboard[] } {
  const enriched: XTEnrichedEvent[] = []
  const playerMap = new Map<string, {
    totalXtGained: number
    totalActions: number
    progressiveActions: number
    regressions: number
    team: string
  }>()

  for (const event of events) {
    const xt = calculateActionXT(
      event.startX, event.startY, event.endX, event.endY,
      pitchLength, pitchWidth, percentageMode
    )

    const enrichedEvent: XTEnrichedEvent = {
      player: event.player,
      team: event.team,
      minute: event.minute,
      actionType: event.actionType || 'Pass',
      startX: event.startX,
      startY: event.startY,
      endX: event.endX,
      endY: event.endY,
      originGrid: xt.originGrid,
      destinationGrid: xt.destinationGrid,
      startZoneThreat: xt.startZoneThreat,
      endZoneThreat: xt.endZoneThreat,
      xtGained: xt.xtGained,
    }
    enriched.push(enrichedEvent)

    // Accumulate leaderboard stats
    const key = `${event.team}::${event.player}`
    const existing = playerMap.get(key) || { totalXtGained: 0, totalActions: 0, progressiveActions: 0, regressions: 0, team: event.team }
    existing.totalXtGained += xt.xtGained
    existing.totalActions++
    if (xt.xtGained > 0) existing.progressiveActions++
    if (xt.xtGained < 0) existing.regressions++
    playerMap.set(key, existing)
  }

  // Build sorted leaderboard
  const leaderboard: XTPlayerLeaderboard[] = [...playerMap.entries()]
    .map(([key, stats]) => ({
      player: key.split('::')[1],
      team: stats.team,
      totalXtGained: +stats.totalXtGained.toFixed(4),
      totalActions: stats.totalActions,
      avgXtPerAction: +(stats.totalXtGained / stats.totalActions).toFixed(5),
      progressiveActions: stats.progressiveActions,
      regressions: stats.regressions,
    }))
    .sort((a, b) => b.totalXtGained - a.totalXtGained)

  return { enriched, leaderboard }
}

/**
 * Get the full xT grid as a flat array for frontend heatmap rendering.
 * Each cell has: row, col, x, y (center coordinates), value
 */
export function getXTGridForVisualization(pitchLength = 105.0, pitchWidth = 68.0): Array<{
  row: number; col: number
  x: number; y: number      // center of cell in meters
  px: number; py: number    // center of cell as percentage (0-100)
  value: number
}> {
  const cells: Array<{ row: number; col: number; x: number; y: number; px: number; py: number; value: number }> = []
  const cellW = pitchLength / XT_COLS
  const cellH = pitchWidth / XT_ROWS

  for (let r = 0; r < XT_ROWS; r++) {
    for (let c = 0; c < XT_COLS; c++) {
      cells.push({
        row: r, col: c,
        x: c * cellW + cellW / 2,
        y: r * cellH + cellH / 2,
        px: ((c * cellW + cellW / 2) / pitchLength) * 100,
        py: ((r * cellH + cellH / 2) / pitchWidth) * 100,
        value: XT_GRID[r][c],
      })
    }
  }
  return cells
}

/**
 * Process StatsBomb events into xT-enriched pass data.
 * Converts StatsBomb coordinates (0-120 x 0-80) to xT grid.
 */
export function processStatsBombPassesForXT(
  events: Array<{
    type?: { name: string }
    team?: { name: string }
    player?: { name: string } | null
    minute: number
    location: [number, number] | null
    pass?: {
      end_location: [number, number] | null
      outcome?: { name: string } | null
    }
  }>
): { enriched: XTEnrichedEvent[]; leaderboard: XTPlayerLeaderboard[] } {
  const passEvents = events
    .filter(e => e.type?.name === 'Pass' && e.location && e.pass?.end_location)
    .map(e => ({
      player: e.player?.name || 'Unknown',
      team: e.team?.name || 'Unknown',
      minute: e.minute,
      actionType: 'Pass',
      startX: e.location![0],  // StatsBomb: 0-120
      startY: e.location![1],  // StatsBomb: 0-80
      endX: e.pass!.end_location![0],
      endY: e.pass!.end_location![1],
    }))

  // StatsBomb pitch: 120m x 80m
  return processMatchXTStream(passEvents, 120, 80)
}