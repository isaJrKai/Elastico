/**
 * ELASTICO Asset System
 *
 * Centralized resolution, caching, and fallback logic for:
 *   - Team crests (badges/logos)
 *   - Player headshots
 *   - Country flags
 *   - League badges
 *
 * Data sources:
 *   - ESPN public API (team logos, no key needed) — primary
 *   - TheSportsDB (badges, player cutouts) — secondary
 *   - flagcdn.com (country flags) — fallback for nationality
 *
 * Rules:
 *   1. Every resolved URL goes through resolveCrest/resolveHeadshot/resolveFlag
 *   2. If the primary URL fails, the system falls back gracefully
 *   3. Components NEVER render raw <img> with unknown URLs — always use
 *      <TeamCrest>, <PlayerHeadshot>, <FlagIcon> primitives
 *   4. Image cache lives in memory (Map) with TTL-based expiry
 */

// ── Image Cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  url: string
  status: 'ok' | 'error'
  ts: number
}

/** In-memory image URL cache. Avoids re-resolving known-good/known-bad URLs. */
class AssetCache {
  private store = new Map<string, CacheEntry>()
  private ttl: number

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttl = ttlMs
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > this.ttl) {
      this.store.delete(key)
      return undefined
    }
    return entry
  }

  set(key: string, url: string, status: 'ok' | 'error') {
    this.store.set(key, { url, status, ts: Date.now() })
  }

  hasError(key: string): boolean {
    return this.get(key)?.status === 'error'
  }

  getOk(key: string): string | undefined {
    const entry = this.get(key)
    return entry?.status === 'ok' ? entry.url : undefined
  }

  clear() {
    this.store.clear()
  }
}

export const crestCache = new AssetCache(10 * 60 * 1000)  // 10 min — crests change rarely
export const headshotCache = new AssetCache(10 * 60 * 1000)
export const flagCache = new AssetCache(60 * 60 * 1000)   // 1 hour — flags never change

// ── URL Validation ────────────────────────────────────────────────────────

function isValidUrl(s: string | null | undefined): boolean {
  if (!s || typeof s !== 'string') return false
  const trimmed = s.trim()
  if (trimmed.length < 10) return false
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// ── Country → ISO Code Mapping ────────────────────────────────────────────

/** Common football nationality → ISO 3166-1 alpha-2 code */
const NATIONALITY_MAP: Record<string, string> = {
  'england': 'gb', 'english': 'gb',
  'scotland': 'gb-sct', 'scottish': 'gb-sct',
  'wales': 'gb-wls', 'welsh': 'gb-wls',
  'northern ireland': 'gb-nir',
  'france': 'fr', 'french': 'fr',
  'germany': 'de', 'german': 'de',
  'spain': 'es', 'spanish': 'es',
  'italy': 'it', 'italian': 'it',
  'portugal': 'pt', 'portuguese': 'pt',
  'brazil': 'br', 'brazilian': 'br',
  'argentina': 'ar', 'argentine': 'ar',
  'netherlands': 'nl', 'dutch': 'nl',
  'belgium': 'be', 'belgian': 'be',
  'croatia': 'hr', 'croatian': 'hr',
  'serbia': 'rs', 'serbian': 'rs',
  'switzerland': 'ch', 'swiss': 'ch',
  'austria': 'at', 'austrian': 'at',
  'poland': 'pl', 'polish': 'pl',
  'ukraine': 'ua', 'ukrainian': 'ua',
  'turkey': 'tr', 'turkish': 'tr',
  'usa': 'us', 'american': 'us',
  'united states': 'us',
  'mexico': 'mx', 'mexican': 'mx',
  'japan': 'jp', 'japanese': 'jp',
  'south korea': 'kr', 'korean': 'kr',
  'korea republic': 'kr',
  'australia': 'au', 'australian': 'au',
  'canada': 'ca', 'canadian': 'ca',
  'morocco': 'ma', 'moroccan': 'ma',
  'ghana': 'gh', 'ghanaian': 'gh',
  'senegal': 'sn', 'senegalese': 'sn',
  'nigeria': 'ng', 'nigerian': 'ng',
  'cameroon': 'cm', 'cameroonian': 'cm',
  'ivory coast': 'ci', 'côte d\'ivoire': 'ci',
  'algeria': 'dz', 'algerian': 'dz',
  'tunisia': 'tn', 'tunisian': 'tn',
  'egypt': 'eg', 'egyptian': 'eg',
  'colombia': 'co', 'colombian': 'co',
  'uruguay': 'uy', 'uruguayan': 'uy',
  'chile': 'cl', 'chilean': 'cl',
  'ecuador': 'ec', 'ecuadorian': 'ec',
  'peru': 'pe', 'peruvian': 'pe',
  'paraguay': 'py', 'paraguayan': 'py',
  'denmark': 'dk', 'danish': 'dk',
  'sweden': 'se', 'swedish': 'se',
  'norway': 'no', 'norwegian': 'no',
  'finland': 'fi', 'finnish': 'fi',
  'iceland': 'is', 'icelandic': 'is',
  'ireland': 'ie', 'irish': 'ie',
  'republic of ireland': 'ie',
  'czech republic': 'cz', 'czech': 'cz',
  'slovakia': 'sk', 'slovak': 'sk',
  'hungary': 'hu', 'hungarian': 'hu',
  'romania': 'ro', 'romanian': 'ro',
  'russia': 'ru', 'russian': 'ru',
  'china': 'cn', 'chinese': 'cn',
  'saudi arabia': 'sa', 'saudi': 'sa',
  'iran': 'ir', 'iranian': 'ir',
  'qatar': 'qa', 'united arab emirates': 'ae',
  'costa rica': 'cr', 'costa rican': 'cr',
  'jamaica': 'jm', 'jamaican': 'jm',
  'panama': 'pa', 'panamanian': 'pa',
  'venezuela': 've', 'venezuelan': 've',
  'bolivia': 'bo', 'bolivian': 'bo',
} as const

/** Direct ISO code overrides for common edge cases */
const ISO_OVERRIDES: Record<string, string> = {
  'UK': 'gb',
  'USA': 'us',
  'KOR': 'kr',
  'NED': 'nl',
  'GER': 'de',
  'ESP': 'es',
  'ITA': 'it',
  'FRA': 'fr',
  'POR': 'pt',
  'BRA': 'br',
  'ARG': 'ar',
  'ENG': 'gb-eng',
  'SCO': 'gb-sct',
  'WAL': 'gb-wls',
} as const

// ── League Badge URL Patterns (ESPN) ─────────────────────────────────────

const LEAGUE_BADGE_OVERRIDES: Record<string, string> = {
  'PL':    'https://a.espncdn.com/i/leaguelogos/soccer/500/1.png',
  'LIGA':  'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
  'SA':    'https://a.espncdn.com/i/leaguelogos/soccer/500/3.png',
  'BL':    'https://a.espncdn.com/i/leaguelogos/soccer/500/4.png',
  'L1':    'https://a.espncdn.com/i/leaguelogos/soccer/500/5.png',
  'UCL':   'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png',
  'UEL':   'https://a.espncdn.com/i/leaguelogos/soccer/500/11.png',
  'MLS':   'https://a.espncdn.com/i/leaguelogos/soccer/500/17.png',
  'WC':    'https://a.espncdn.com/i/leaguelogos/soccer/500/1000.png',
  'EURO':  'https://a.espncdn.com/i/leaguelogos/soccer/500/1001.png',
} as const

// ── Crest Resolution ─────────────────────────────────────────────────────

export interface ResolvedCrest {
  url: string | null
  source: 'espn' | 'tsd' | 'fallback'
  /** Fallback color for rendering a colored circle when no URL */
  fallbackColor: string
  /** Text to show in fallback (team code/abbreviation) */
  fallbackText: string
}

/**
 * Resolve a team crest URL from multiple possible inputs.
 *
 * Priority:
 *  1. Direct ESPN logo URL (from football-data.ts)
 *  2. TheSportsDB badge URL
 *  3. Colored circle fallback with team initials
 *
 * @param inputs - All possible logo/badge URLs from different sources
 * @param code - Team abbreviation for fallback text (e.g. "MCI")
 * @param color - Team primary color for fallback circle
 */
export function resolveCrest(
  inputs: {
    espnLogo?: string | null
    tsdBadge?: string | null
    tsdBadgeLg?: string | null
    logo?: string | null
  },
  code: string,
  color?: string | null,
): ResolvedCrest {
  const key = `${code}_${inputs.espnLogo || ''}_${inputs.tsdBadge || ''}`

  // Check cache
  const cached = crestCache.getOk(key)
  if (cached) {
    return {
      url: cached,
      source: cached.includes('espn') ? 'espn' : cached.includes('thesportsdb') ? 'tsd' : 'fallback',
      fallbackColor: color || '#555555',
      fallbackText: code || '?',
    }
  }
  if (crestCache.hasError(key)) {
    return { url: null, source: 'fallback', fallbackColor: color || '#555555', fallbackText: code || '?' }
  }

  // Try ESPN logo (most reliable, transparent PNG)
  if (isValidUrl(inputs.espnLogo)) {
    crestCache.set(key, inputs.espnLogo!, 'ok')
    return { url: inputs.espnLogo!, source: 'espn', fallbackColor: color || '#555555', fallbackText: code || '?' }
  }

  // Try TheSportsDB badge
  if (isValidUrl(inputs.tsdBadge)) {
    crestCache.set(key, inputs.tsdBadge!, 'ok')
    return { url: inputs.tsdBadge!, source: 'tsd', fallbackColor: color || '#555555', fallbackText: code || '?' }
  }

  // Try TheSportsDB large badge
  if (isValidUrl(inputs.tsdBadgeLg)) {
    crestCache.set(key, inputs.tsdBadgeLg!, 'ok')
    return { url: inputs.tsdBadgeLg!, source: 'tsd', fallbackColor: color || '#555555', fallbackText: code || '?' }
  }

  // Try generic logo field
  if (isValidUrl(inputs.logo)) {
    crestCache.set(key, inputs.logo!, 'ok')
    return { url: inputs.logo!, source: 'fallback', fallbackColor: color || '#555555', fallbackText: code || '?' }
  }

  // No valid URL — return fallback
  crestCache.set(key, '', 'error')
  return { url: null, source: 'fallback', fallbackColor: color || '#555555', fallbackText: code || '?' }
}

// ── Player Headshot Resolution ───────────────────────────────────────────

export interface ResolvedHeadshot {
  url: string | null
  source: 'tsd-cutout' | 'tsd-thumb' | 'fallback'
  /** Fallback initials for rendering a circle */
  fallbackText: string
}

/**
 * Resolve a player headshot URL.
 *
 * Priority:
 *  1. TheSportsDB cutout (transparent background)
 *  2. TheSportsDB thumb (smaller, has background)
 *  3. Initials circle fallback
 */
export function resolveHeadshot(
  inputs: {
    tsdCutout?: string | null
    tsdThumb?: string | null
    espnHeadshot?: string | null
    genericUrl?: string | null
  },
  name: string,
): ResolvedHeadshot {
  const key = `${name}_${inputs.tsdCutout || ''}`

  const cached = headshotCache.getOk(key)
  if (cached) {
    return {
      url: cached,
      source: cached.includes('cutout') ? 'tsd-cutout' : cached.includes('thumb') ? 'tsd-thumb' : 'fallback',
      fallbackText: extractInitials(name),
    }
  }
  if (headshotCache.hasError(key)) {
    return { url: null, source: 'fallback', fallbackText: extractInitials(name) }
  }

  // TheSportsDB cutout (best — transparent background, standing pose)
  if (isValidUrl(inputs.tsdCutout)) {
    headshotCache.set(key, inputs.tsdCutout!, 'ok')
    return { url: inputs.tsdCutout!, source: 'tsd-cutout', fallbackText: extractInitials(name) }
  }

  // TheSportsDB thumb (smaller, has background)
  if (isValidUrl(inputs.tsdThumb)) {
    headshotCache.set(key, inputs.tsdThumb!, 'ok')
    return { url: inputs.tsdThumb!, source: 'tsd-thumb', fallbackText: extractInitials(name) }
  }

  // Generic URL
  if (isValidUrl(inputs.espnHeadshot ?? inputs.genericUrl)) {
    const url = inputs.espnHeadshot || inputs.genericUrl!
    headshotCache.set(key, url, 'ok')
    return { url, source: 'fallback', fallbackText: extractInitials(name) }
  }

  headshotCache.set(key, '', 'error')
  return { url: null, source: 'fallback', fallbackText: extractInitials(name) }
}

// ── Flag Resolution ──────────────────────────────────────────────────────

export interface ResolvedFlag {
  url: string | null
  isoCode: string | null
  /** Raw nationality string for display */
  label: string
}

/**
 * Resolve a country flag URL from a nationality string.
 *
 * Uses flagcdn.com which provides free SVG/PNG flags by ISO code.
 *
 * @param nationality - Nationality string (e.g. "English", "Brazil", "FR")
 */
export function resolveFlag(nationality: string | null | undefined): ResolvedFlag {
  if (!nationality || typeof nationality !== 'string') {
    return { url: null, isoCode: null, label: '' }
  }

  const trimmed = nationality.trim()
  const key = `flag_${trimmed.toLowerCase()}`

  const cached = flagCache.getOk(key)
  if (cached) {
    return { url: cached, isoCode: extractIsoCode(trimmed), label: trimmed }
  }

  const isoCode = extractIsoCode(trimmed)
  if (!isoCode) {
    flagCache.set(key, '', 'error')
    return { url: null, isoCode: null, label: trimmed }
  }

  // flagcdn.com: w20 = 20px wide, w40 = 40px wide
  const url = `https://flagcdn.com/w40/${isoCode}.png`
  flagCache.set(key, url, 'ok')
  return { url, isoCode, label: trimmed }
}

// ── League Badge Resolution ──────────────────────────────────────────────

export interface ResolvedLeagueBadge {
  url: string | null
  source: 'espn' | 'fallback'
  label: string
}

/**
 * Resolve a league/competition badge URL.
 *
 * @param code - League code (e.g. "PL", "UCL")
 * @param name - League full name (for fallback text)
 */
export function resolveLeagueBadge(code: string | null | undefined, name?: string): ResolvedLeagueBadge {
  if (!code) {
    return { url: null, source: 'fallback', label: name || '' }
  }

  const url = LEAGUE_BADGE_OVERRIDES[code.toUpperCase()] || null
  return {
    url,
    source: url ? 'espn' : 'fallback',
    label: name || code,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Extract initials from a player name (e.g. "Kevin De Bruyne" → "KD") */
function extractInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Extract ISO 3166-1 alpha-2 from a nationality string */
function extractIsoCode(nationality: string): string | null {
  const lower = nationality.toLowerCase().trim()

  // Direct lookup by nationality name
  if (NATIONALITY_MAP[lower]) return NATIONALITY_MAP[lower]

  // Check ISO overrides (for 3-letter codes)
  if (ISO_OVERRIDES[nationality.toUpperCase()]) return ISO_OVERRIDES[nationality.toUpperCase()]

  // Already a 2-letter ISO code
  if (/^[a-z]{2}$/.test(lower)) return lower

  // Try extracting from compound names (e.g. "Bosnia and Herzegovina")
  for (const [key, code] of Object.entries(NATIONALITY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return code
  }

  return null
}

// ── onError handler for <img> ────────────────────────────────────────────

/**
 * Call this from an <img> onError to mark the URL as failed in cache.
 * The component should then switch to fallback rendering.
 */
export function handleAssetError(type: 'crest' | 'headshot' | 'flag', key: string) {
  const cache = type === 'crest' ? crestCache : type === 'headshot' ? headshotCache : flagCache
  cache.set(key, '', 'error')
}
