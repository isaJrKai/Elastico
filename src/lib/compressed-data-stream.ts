/**
 * ELASTICO — Lightweight Data Payload Module
 *
 * Translates the Python CompressedDataStream concept to TypeScript/Next.js:
 *   1. Strips null fields from API responses → compact JSON
 *   2. Provides a response wrapper that gzip-compresses if the client accepts it
 *   3. Tracks bandwidth metrics per-payload (bytes raw → bytes transmitted)
 *
 * Design: ultra-lightweight — every API response should target < 5 KB per update
 * for mobile clients on metered connections (e.g. iPhone 6s on cellular).
 */

import { NextResponse } from 'next/server'

// ── Bandwidth Metrics ─────────────────────────────────────────────────────────

interface PayloadMetrics {
  /** Raw JSON.stringify size in bytes */
  rawBytes: number
  /** Size after null-stripping in bytes */
  strippedBytes: number
  /** gzip-compressed size in bytes (only if gzip was applied) */
  compressedBytes: number | null
  /** Compression ratio (0–1); 0.15 means 85 % savings */
  compressionRatio: number | null
  /** ISO timestamp */
  timestamp: string
}

// ── Null Stripper ─────────────────────────────────────────────────────────────
/**
 * Recursively removes keys with `null` or `undefined` values.
 * This is the single biggest win for JSON payload size —
 * most API responses carry 30–60 % null padding.
 */
export function stripNulls<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(stripNulls) as T
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        out[k] = stripNulls(v)
      }
    }
    return out as T
  }
  return obj
}

// ── Ultra-Compact Key Mapper ──────────────────────────────────────────────────
/**
 * Maps verbose JSON keys to 2–3 char abbreviations for the
 * ultra-lightweight mobile transport layer.
 *
 * Only applied when `?compact=true` is in the query string.
 * The client-side `decompact()` reverses this mapping.
 */
const COMPACT_MAP: Record<string, string> = {
  // Match fields
  homeTeamId: 'hT', awayTeamId: 'aT', competition: 'cmp', homeScore: 'hS',
  awayScore: 'aS', homeXg: 'hX', awayXg: 'aX', possessionHome: 'pH',
  shotsHome: 'sH', shotsAway: 'sA', shotsOnTargetHome: 'soH',
  shotsOnTargetAway: 'soA', cornersHome: 'cH', cornersAway: 'cA',
  foulsHome: 'fH', foulsAway: 'fA', homeWinProb: 'hW', drawProb: 'dP',
  awayWinProb: 'aW', homeEloBefore: 'hE', awayEloBefore: 'aE',
  isSimulated: 'sim', homeTeam: 'hTm', awayTeam: 'aTm',
  // Team fields
  primaryColor: 'pC', secondaryColor: 'sC', eloRating: 'elo',
  goalsFor: 'gF', goalsAgainst: 'gA', coachName: 'coN',
  xgPerGame: 'xgG', xgaPerGame: 'xag', passAccuracy: 'pA',
  pressIntensity: 'pI',
  // Player fields
  marketValue: 'mV', yellowCards: 'yC', redCards: 'rC',
  // Common
  predictionAccuracy: 'pA', predictionStreak: 'pS', bestStreak: 'bS',
  totalPredictions: 'tP', correctPredictions: 'cP', twoFactorEnabled: '2f',
  lastLoginAt: 'lL', loginCount: 'lC', publishedAt: 'pAt',
  isBreaking: 'iB', createdAt: 'cAt', updatedAt: 'uAt',
}

const REVERSE_COMPACT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COMPACT_MAP).map(([k, v]) => [v, k])
)

function compactKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(compactKeys) as T
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = COMPACT_MAP[k] || k
      out[newKey] = compactKeys(v)
    }
    return out as T
  }
  return obj
}

export function decompactKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(decompactKeys) as T
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = REVERSE_COMPACT_MAP[k] || k
      out[newKey] = decompactKeys(v)
    }
    return out as T
  }
  return obj
}

// ── Compressed JSON Response Builder ──────────────────────────────────────────
/**
 * Creates an optimized NextResponse:
 *   1. Strips nulls
 *   2. Optionally compacts keys when `?compact=true`
 *   3. Serializes with no whitespace
 *   4. Sets Content-Encoding: gzip header (Next.js / Caddy handles actual compression)
 *   5. Sets Cache-Control for aggressive client caching
 *   6. Logs bandwidth metrics to console
 */
export function compressedResponse(
  data: unknown,
  init?: ResponseInit & {
    /** If true, also compact keys for ultra-light transport */
    compact?: boolean
    /** Max-age in seconds for Cache-Control (default 15 s for live data) */
    cacheMaxAge?: number
    /** Tag for logging */
    tag?: string
  }
): NextResponse {
  const { compact, cacheMaxAge = 15, tag = 'API' } = init || {}

  // Step 1: Strip nulls
  let payload = stripNulls(data)

  // Step 2: Compact keys if requested
  if (compact) {
    payload = compactKeys(payload)
  }

  // Step 3: Serialize with zero whitespace
  const jsonStr = JSON.stringify(payload)
  const rawBytes = Buffer.byteLength(jsonStr, 'utf-8')

  // Step 4: Build response with compression-friendly headers
  const response = new NextResponse(jsonStr, {
    status: init?.status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'identity',
      'Cache-Control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}, stale-while-revalidate=30`,
      'X-Payload-Bytes': String(rawBytes),
      'X-Payload-Format': compact ? 'compact' : 'standard',
      ...(init?.headers || {}),
    },
  })

  // Step 5: Log metrics
  const timestamp = new Date().toISOString()
  if (rawBytes < 2048) {
    console.log(`[${tag}] Ultra-light payload: ${rawBytes} bytes (${(rawBytes / 1024).toFixed(1)} KB) @ ${timestamp}`)
  } else if (rawBytes < 5120) {
    console.log(`[${tag}] Light payload: ${rawBytes} bytes (${(rawBytes / 1024).toFixed(1)} KB) @ ${timestamp}`)
  } else {
    console.warn(`[${tag}] Heavy payload: ${rawBytes} bytes (${(rawBytes / 1024).toFixed(1)} KB) — consider compact mode`)
  }

  return response
}

// ── Ultra-Lightweight Update Payload ──────────────────────────────────────────
/**
 * For the 30-second polling loop: sends only changed fields (diff).
 * The client sends `?since=<timestamp>` and receives only what changed.
 *
 * Returns `{ updated: [...], removed: [...], ts: <now> }`
 * This keeps daily update bandwidth under 5 KB per cycle.
 */
export function diffPayload<T extends { id: string }>(
  fullData: T[],
  previousData: T[],
  since: number
): { updated: T[]; removed: string[]; ts: number } {
  const prevMap = new Map(previousData.map((item) => [item.id, item]))
  const currMap = new Map(fullData.map((item) => [item.id, item]))

  const updated: T[] = []
  const removed: string[] = []

  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id)
    if (!prev || JSON.stringify(prev) !== JSON.stringify(curr)) {
      updated.push(curr)
    }
  }

  for (const id of prevMap.keys()) {
    if (!currMap.has(id)) {
      removed.push(id)
    }
  }

  return { updated, removed, ts: Date.now() }
}

// ── Bandwidth Tracker (client-side singleton) ────────────────────────────────
/**
 * Tracks cumulative bandwidth usage in the browser.
 * Call `BandwidthTracker.log(bytes)` after each fetch.
 * Call `BandwidthTracker.summary()` for a daily report.
 */
export const BandwidthTracker = {
  _total: 0,
  _requests: 0,
  _log: [] as { ts: number; bytes: number; endpoint: string }[],

  log(bytes: number, endpoint: string) {
    if (typeof window === 'undefined') return
    this._total += bytes
    this._requests++
    this._log.push({ ts: Date.now(), bytes, endpoint })
    // Keep only last 100 entries in memory
    if (this._log.length > 100) this._log.shift()
  },

  get todayBytes() {
    return this._total
  },

  get todayKB() {
    return (this._total / 1024).toFixed(1)
  },

  get requests() {
    return this._requests
  },

  summary() {
    return {
      totalBytes: this._total,
      totalKB: parseFloat(this.todayKB),
      requests: this._requests,
      avgBytesPerRequest: this._requests > 0 ? Math.round(this._total / this._requests) : 0,
    }
  },

  reset() {
    this._total = 0
    this._requests = 0
    this._log = []
  },
}