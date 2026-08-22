/**
 * ELASTICO — Entity Resolution for Understat → Canonical Team
 *
 * Strategy: name-based matching with manual alias table.
 * Understat team names are matched to DB teams (typically API-Sports sourced)
 * by normalized name + league code.
 *
 * Resolution confidence levels:
 *   EXACT    — exact case-insensitive name match + same league
 *   ALIAS    — matched via known alias table
 *   NORMALIZED — normalized name match (after stripping FC/CF/SC, accents)
 *   UNRESOLVED — no match found or ambiguous (multiple candidates)
 *
 * CRITICAL: UNRESOLVED teams are logged but NEVER auto-merged.
 */

import type { PrismaClient } from '@prisma/client'

export type ResolutionConfidence = 'EXACT' | 'ALIAS' | 'NORMALIZED' | 'UNRESOLVED'

export interface ResolvedTeam {
  dbTeamId: string
  confidence: ResolutionConfidence
  method: string
  understatTeamId: number
  understatTeamName: string
  matchedDbTeamName: string
}

// ── Manual alias table ───────────────────────────────────────────────
// Maps Understat team name → expected DB team name for known discrepancies.
// This is the most reliable resolution method for the ~100 teams in 5 leagues.

const UNDERSTAT_ALIASES: Record<string, string> = {
  // Premier League
  'Manchester United': 'Manchester United',
  'Manchester City': 'Manchester City',
  'Liverpool': 'Liverpool',
  'Arsenal': 'Arsenal',
  'Chelsea': 'Chelsea',
  'Tottenham Hotspur': 'Tottenham Hotspur',
 'Newcastle United': 'Newcastle United',
  'Aston Villa': 'Aston Villa',
 'Brighton': 'Brighton and Hove Albion',
  'Brighton and Hove Albion': 'Brighton and Hove Albion',
 'West Ham': 'West Ham United',
  'West Ham United': 'West Ham United',
  'Crystal Palace': 'Crystal Palace',
  'Wolverhampton': 'Wolverhampton Wanderers',
  'Wolverhampton Wanderers': 'Wolverhampton Wanderers',
  'Fulham': 'Fulham',
 'Brentford': 'Brentford',
  'Bournemouth': 'AFC Bournemouth',
  'AFC Bournemouth': 'AFC Bournemouth',
  'Everton': 'Everton',
  'Nottingham Forest': 'Nottingham Forest',
  // La Liga
  'Real Madrid': 'Real Madrid',
 'Barcelona': 'FC Barcelona',
 'FC Barcelona': 'FC Barcelona',
 'Atletico Madrid': 'Atletico Madrid',
 'Real Sociedad': 'Real Sociedad',
 'Real Betis': 'Real Betis',
 'Villarreal': 'Villarreal CF',
  'Villarreal CF': 'Villarreal CF',
 'Athletic Bilbao': 'Athletic Club',
 'Athletic Club': 'Athletic Club',
 'Sevilla': 'Sevilla FC',
  'Sevilla FC': 'Sevilla FC',
  'Girona': 'Girona FC',
 'Girona FC': 'Girona FC',
 'Celta Vigo': 'Celta de Vigo',
  'Celta de Vigo': 'Celta de Vigo',
 'Getafe': 'Getafe CF',
  'Getafe CF': 'Getafe CF',
  'Rayo Vallecano': 'Rayo Vallecano',
 'Osasuna': 'CA Osasuna',
 'CA Osasuna': 'CA Osasuna',
 'Las Palmas': 'UD Las Palmas',
  'UD Las Palmas': 'UD Las Palmas',
  'Alaves': 'Deportivo Alaves',
 'Deportivo Alaves': 'Deportivo Alaves',
 'Almeria': 'UD Almeria',
  'UD Almeria': 'UD Almeria',
  'Cadiz': 'Cadiz CF',
  'Cadiz CF': 'Cadiz CF',
 'Valencia': 'Valencia CF',
  'Valencia CF': 'Valencia CF',
 'Mallorca': 'RCD Mallorca',
 'RCD Mallorca': 'RCD Mallorca',
  // Serie A
  'Inter': 'Inter',
  'Inter Milan': 'Inter',
 'Milan': 'AC Milan',
  'AC Milan': 'AC Milan',
  'Juventus': 'Juventus',
  'Napoli': 'Napoli',
  'Roma': 'AS Roma',
 'AS Roma': 'AS Roma',
  'Lazio': 'SS Lazio',
  'SS Lazio': 'SS Lazio',
  'Atalanta': 'Atalanta',
  'Fiorentina': 'ACF Fiorentina',
  'ACF Fiorentina': 'ACF Fiorentina',
  'Bologna': 'Bologna FC',
  'Bologna FC': 'Bologna FC',
  'Torino': 'Torino FC',
  'Torino FC': 'Torino FC',
  'Monza': 'AC Monza',
  'AC Monza': 'AC Monza',
 'Udinese': 'Udinese',
 'Sassuolo': 'US Sassuolo',
 'US Sassuolo': 'US Sassuolo',
 'Empoli': 'Empoli',
 'Cagliari': 'Cagliari Calcio',
  'Cagliari Calcio': 'Cagliari Calcio',
 'Lecce': 'US Lecce',
  'US Lecce': 'US Lecce',
 'Genoa': 'Genoa CFC',
  'Genoa CFC': 'Genoa CFC',
 'Hellas Verona': 'Hellas Verona',
  'Frosinone': 'Frosinone',
 'Salernitana': 'US Salernitana',
  'US Salernitana': 'US Salernitana',
  // Bundesliga
  'Bayer Leverkusen': 'Bayer 04 Leverkusen',
  'Bayer 04 Leverkusen': 'Bayer 04 Leverkusen',
 'Bayer Munich': 'Bayern Munich',
 'Bayern München': 'FC Bayern München',
  'FC Bayern München': 'FC Bayern München',
 'Borussia Dortmund': 'Borussia Dortmund',
 'RB Leipzig': 'RB Leipzig',
 'Stuttgart': 'VfB Stuttgart',
  'VfB Stuttgart': 'VfB Stuttgart',
 'Eintracht Frankfurt': 'Eintracht Frankfurt',
 'Wolfsburg': 'VfL Wolfsburg',
  'VfL Wolfsburg': 'VfL Wolfsburg',
 'Freiburg': 'SC Freiburg',
  'SC Freiburg': 'SC Freiburg',
  'Hoffenheim': 'TSG Hoffenheim',
  'TSG Hoffenheim': 'TSG Hoffenheim',
 'Union Berlin': '1. FC Union Berlin',
 '1. FC Union Berlin': '1. FC Union Berlin',
 'Werder Bremen': 'SV Werder Bremen',
  'SV Werder Bremen': 'SV Werder Bremen',
 'M'gladbach': 'Borussia Mönchengladbach',
  'Borussia Mönchengladbach': 'Borussia Mönchengladbach',
 'Mainz 05': '1. FSV Mainz 05',
  '1. FSV Mainz 05': '1. FSV Mainz 05',
  'Augsburg': 'FC Augsburg',
  'FC Augsburg': 'FC Augsburg',
 'Bochum': 'VfL Bochum',
  'VfL Bochum': 'VfL Bochum',
 'Darmstadt': 'SV Darmstadt 98',
  'SV Darmstadt 98': 'SV Darmstadt 98',
 'Heidenheim': '1. FC Heidenheim 1846',
  '1. FC Heidenheim 1846': '1. FC Heidenheim 1846',
  'Köln': '1. FC Köln',
  '1. FC Köln': '1. FC Köln',
 'St. Pauli': 'FC St. Pauli',
  'FC St. Pauli': 'FC St. Pauli',
 'Holstein Kiel': 'Holstein Kiel',
  // Ligue 1
  'Paris Saint-Germain': 'Paris Saint-Germain',
  'PSG': 'Paris Saint-Germain',
  'Marseille': 'Olympique de Marseille',
  'Olympique de Marseille': 'Olympique de Marseille',
 'Monaco': 'AS Monaco',
  'AS Monaco': 'AS Monaco',
 'Lyon': 'Olympique Lyonnais',
  'Olympique Lyonnais': 'Olympique Lyonnais',
 'Lille': 'LOSC Lille',
 LOSC Lille': 'LOSC Lille',
 'Nice': 'OGC Nice',
  'OGC Nice': 'OGC Nice',
  'Lens': 'RC Lens',
  'RC Lens': 'RC Lens',
  'Rennes': 'Stade Rennais FC',
  'Stade Rennais FC': 'Stade Rennais FC',
 'Strasbourg': 'RC Strasbourg Alsace',
  'RC Strasbourg Alsace': 'RC Strasbourg Alsace',
 'Toulouse': 'Toulouse FC',
  'Toulouse FC': 'Toulouse FC',
 'Montpellier': 'Montpellier HSC',
  'Montpellier HSC': 'Montpellier HSC',
 'Nantes': 'FC Nantes',
 FC Nantes': 'FC Nantes',
  'Reims': 'Stade de Reims',
  'Stade de Reims': 'Stade de Reims',
  'Brest': 'Stade Brestois 29',
  'Stade Brestois 29': 'Stade Brestois 29',
 'Le Havre': 'Le Havre AC',
  'Le Havre AC': 'Le Havre AC',
  'Lorient': 'FC Lorient',
  'FC Lorient': 'FC Lorient',
  'Metz': 'FC Metz',
 FC Metz': 'FC Metz',
  'Auxerre': 'AJ Auxerre',
  'AJ Auxerre': 'AJ Auxerre',
  'Angers': 'Angers SCO',
  'Angers SCO': 'Angers SCO',
}

// ── Name normalization ─────────────────────────────────────────────────

/**
 * Normalizes a team name for fuzzy matching.
 * Strips common prefixes/suffixes, normalizes accents, lowercases.
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    // Strip common prefixes
    .replace(/^(1\.\s*fc\s*|fc\s*|sc\s*|vfl\s*|sv\s*|rc\s*|as\s*|us\s*|ud\s*|ss\s*|ac\s*|afc\s*)/i, '')
    // Strip common suffixes
    .replace(/\s*(fc|sc|cf|ac|sv|rc|vsp|tsc|vfb|rc|cf|1\.\s*fc|ogc|ras|soc|co|sco)\s*$/i, '')
    // Remove dots and hyphens
    .replace(/[.\-]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize a league code for matching purposes.
 */
function normalizeLeagueCode(code: string): string {
  return code.toUpperCase().trim()
}

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Resolve an Understat team to a canonical DB team.
 * Returns UNRESOLVED if no unique match is found.
 */
export async function resolveUnderstatTeam(
  db: PrismaClient,
  understatTeamId: number,
  understatTeamName: string,
  leagueCode: string,
  season: string,
): Promise<ResolvedTeam> {
  const unresolved: ResolvedTeam = {
    dbTeamId: '',
    confidence: 'UNRESOLVED',
    method: 'none',
    understatTeamId,
    understatTeamName,
    matchedDbTeamName: '',
  }

  // 1. EXACT match: case-insensitive name + same league
  const exactMatches = await db.team.findMany({
    where: {
      leagueCode: normalizeLeagueCode(leagueCode),
      name: { equals: understatTeamName, mode: 'insensitive' },
    },
 })
  if (exactMatches.length === 1) {
    return {
      dbTeamId: exactMatches[0].id,
      confidence: 'EXACT',
      method: 'exact_name_league',
      understatTeamId,
      understatTeamName,
      matchedDbTeamName: exactMatches[0].name,
    }
  }

  // 2. ALIAS match: known name discrepancies
  const aliasTarget = UNDERSTAT_ALIASES[understatTeamName]
  if (aliasTarget) {
    const aliasMatches = await db.team.findMany({
      where: {
        leagueCode: normalizeLeagueCode(leagueCode),
        name: { equals: aliasTarget, mode: 'insensitive' },
      },
 })
    if (aliasMatches.length === 1) {
      return {
        dbTeamId: aliasMatches[0].id,
        confidence: 'ALIAS',
        method: `alias: "${understatTeamName}" → "${aliasTarget}"`,
      understatTeamId,
      understatTeamName,
      matchedDbTeamName: aliasMatches[0].name,
    }
  }
  }

  // 3. NORMALIZED match: stripped name + same league
  const normalized = normalizeTeamName(understatTeamName)
  if (normalized.length >= 3) {
    const dbTeams = await db.team.findMany({
      where: { leagueCode: normalizeLeagueCode(leagueCode) },
    })
    const normalizedMatches = dbTeams.filter(
      (t) => normalizeTeamName(t.name) === normalized,
    )
    if (normalizedMatches.length === 1) {
      return {
        dbTeamId: normalizedMatches[0].id,
        confidence: 'NORMALIZED',
        method: `normalized: "${understatTeamName}" → "${normalizedMatches[0].name}"`,
        understatTeamId,
        understatTeamName,
        matchedDbTeamName: normalizedMatches[0].name,
    }
    }
  }

  // 4. UNRESOLVED
  console.warn(
    `[EntityResolution] UNRESOLVED: Understat team "${understatTeamName}" ` +
    `(id=${understatTeamId}, league=${leagueCode}, season=${season}) has no unique DB match.`,
  )
  return unresolved
}

/**
 * Batch resolve all Understat teams for a league season.
 * Returns resolved + unresolved arrays.
 */
export async function resolveUnderstatTeams(
  db: PrismaClient,
  understatTeams: Array<{ id: number; title: string; team_name: string }>,
  leagueCode: string,
  season: string,
): Promise<{
  resolved: ResolvedTeam[]
  unresolved: ResolvedTeam[]
}> {
  const resolved: ResolvedTeam[] = []
  const unresolved: ResolvedTeam[] = []

  for (const ut of understatTeams) {
    const name = ut.team_name || ut.title
    const result = await resolveUnderstatTeam(db, ut.id, name, leagueCode, season)
    if (result.confidence === 'UNRESOLVED') {
      unresolved.push(result)
    } else {
    resolved.push(result)
  }
  }

  return { resolved, unresolved }
}
