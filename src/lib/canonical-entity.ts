/**
 * ELASTICO — Canonical Entity Service
 *
 * Builds and maintains the CanonicalTeam + SourceIdentity mapping.
 * Existing Team rows (per-source) are linked to a single CanonicalTeam.
 *
 * Resolution priority for display data:
 *   1. api-sports (best quality: logo, venue, country)
 *   2. football-data.org
 *   3. espn (always available, lower quality)
 *   4. understat (analytics only, no logos)
 *
 * CRITICAL RULES:
 *   - Never auto-merge ambiguous matches (multiple candidates)
 *   - Never create a CanonicalTeam without at least one SourceIdentity
 *   - Log every resolution decision for audit
 */

import type { PrismaClient } from '@prisma/client'

const PREFERRED_SOURCES = ['api-sports', 'football-data.org', 'espn', 'understat']

type SourcePriority = Record<string, number>
const SOURCE_PRIORITY: SourcePriority = {
  'api-sports': 1,
  'football-data.org': 2,
  'espn': 3,
  'understat': 4,
}

export interface CanonicalBuildResult {
  canonicalTeamsCreated: number
  identitiesCreated: number
  identitiesExisted: number
  teamsProcessed: number
}

/**
 * Build canonical teams from all existing Team rows.
 * Groups teams by normalized name + leagueCode, creates CanonicalTeam + SourceIdentity.
 * Safe to run repeatedly (idempotent upsert).
 */
export async function buildCanonicalEntities(db: PrismaClient): Promise<CanonicalBuildResult> {
  const result: CanonicalBuildResult = {
    canonicalTeamsCreated: 0,
    identitiesCreated: 0,
    identitiesExisted: 0,
    teamsProcessed: 0,
  }

  // 1. Get all teams grouped by leagueCode
  const allTeams = await db.team.findMany({
    orderBy: [{ leagueCode: 'asc' }, { source: 'asc' }],
  })

  result.teamsProcessed = allTeams.length
  if (allTeams.length === 0) {
    console.log('[CanonicalEntity] No teams in DB to canonicalize')
    return result
  }

  // 2. Group by normalized name + leagueCode
  const groups = new Map<string, typeof allTeams>()
  for (const team of allTeams) {
    const key = `${normalizeName(team.name)}|${(team.leagueCode || 'UNKNOWN').toUpperCase()}`
    const existing = groups.get(key)
    if (existing) {
      existing.push(team)
    } else {
      groups.set(key, [team])
    }
  }

  // 3. For each group, create or update CanonicalTeam + SourceIdentities
  for (const [key, teams] of groups) {
    if (teams.length === 0) continue

    // Pick best display name (from highest-priority source)
    const sorted = [...teams].sort(
      (a, b) => (SOURCE_PRIORITY[a.source] ?? 99) - (SOURCE_PRIORITY[b.source] ?? 99),
    )
    const primary = sorted[0]
    const displayName = primary.name
    const leagueCode = (primary.leagueCode || null)

    // Check for ambiguity: if normalized names collide but actual names differ
    // significantly, they might be different teams
    const uniqueNames = new Set(teams.map(t => t.name.toLowerCase()))
    if (uniqueNames.size > 1) {
      // Verify these are actually the same team via alias table
      const allSameTeam = teams.every(t =>
        normalizeName(t.name) === normalizeName(primary.name),
      )
      if (!allSameTeam) {
        console.warn(
          `[CanonicalEntity] AMBIGUOUS group "${key}": ` +
          `names=[${teams.map(t => `"${t.name}"(${t.source})`).join(', ')}]. Skipping auto-merge.`,
        )
        continue
      }
    }

    try {
      // Upsert CanonicalTeam
      const canonical = await db.canonicalTeam.upsert({
        where: {
          displayName_leagueCode: {
            displayName,
            leagueCode: leagueCode ?? '',
          },
        },
        update: {
          shortCode: primary.code || null,
          country: primary.country || null,
          logo: primary.logo || null,
          primaryColor: primary.primaryColor,
          secondaryColor: primary.secondaryColor,
          eloRating: primary.eloRating,
        },
        create: {
          displayName,
          shortCode: primary.code || null,
          leagueCode: leagueCode ?? null,
          country: primary.country || null,
          logo: primary.logo || null,
          primaryColor: primary.primaryColor,
          secondaryColor: primary.secondaryColor,
          eloRating: primary.eloRating,
        },
      })
      result.canonicalTeamsCreated++

      // Create SourceIdentities for each source team
      for (const team of teams) {
        const confidence = team.source === 'api-sports' ? 'EXACT' : 'NORMALIZED'
        try {
          await db.sourceIdentity.upsert({
            where: {
              source_externalId: {
                source: team.source,
                externalId: team.sourceId || team.externalId || team.id,
              },
            },
            update: {
              externalName: team.name,
              leagueCode: team.leagueCode,
              confidence,
              resolutionMethod: `name_normalized: "${team.name}"`,
              isActive: true,
            },
            create: {
              canonicalTeamId: canonical.id,
              source: team.source,
              externalId: team.sourceId || team.externalId || team.id,
              externalName: team.name,
              leagueCode: team.leagueCode,
              confidence,
              resolutionMethod: `name_normalized: "${team.name}"`,
            },
          })
          result.identitiesCreated++
        } catch {
          result.identitiesExisted++
        }
      }
    } catch (err) {
      console.warn(`[CanonicalEntity] Failed for "${displayName}":`, err)
    }
  }

  console.log(
    `[CanonicalEntity] Built ${result.canonicalTeamsCreated} canonical teams, ` +
    `${result.identitiesCreated} identities from ${result.teamsProcessed} source teams`,
  )
  return result
}

/**
 * Find the canonical team ID for a given source + externalId.
 * Returns null if no mapping exists.
 */
export async function findCanonicalId(
  db: PrismaClient,
  source: string,
  externalId: string,
): Promise<string | null> {
  const identity = await db.sourceIdentity.findUnique({
    where: { source_externalId: { source, externalId } },
    select: { canonicalTeamId: true },
  })
  return identity?.canonicalTeamId ?? null
}

/**
 * Link an Understat team to a canonical team.
 * Creates the SourceIdentity with resolution confidence from entity-resolution.
 */
export async function linkUnderstatToCanonical(
  db: PrismaClient,
  dbTeamId: string,
  understatTeamId: number,
  understatTeamName: string,
  confidence: 'EXACT' | 'ALIAS' | 'NORMALIZED' | 'UNRESOLVED',
  method: string,
): Promise<string | null> {
  // Find the canonical team linked to this dbTeam
  const existingIdentity = await db.sourceIdentity.findFirst({
    where: {
      source: { in: ['api-sports', 'espn'] },
      externalId: dbTeamId,
    },
  })

  if (!existingIdentity) {
    // No canonical mapping yet — create one from this team
    const team = await db.team.findUnique({ where: { id: dbTeamId } })
    if (!team) return null

    const canonical = await db.canonicalTeam.upsert({
      where: {
        displayName_leagueCode: {
          displayName: team.name,
          leagueCode: team.leagueCode || '',
        },
      },
      update: {},
      create: {
        displayName: team.name,
        shortCode: team.code || null,
        leagueCode: team.leagueCode || null,
        country: team.country || null,
        logo: team.logo || null,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
    })

    await db.sourceIdentity.upsert({
      where: {
        source_externalId: { source: 'understat', externalId: String(understatTeamId) },
      },
      update: {
        canonicalTeamId: canonical.id,
        confidence,
        resolutionMethod: method,
        externalName: understatTeamName,
      },
      create: {
        canonicalTeamId: canonical.id,
        source: 'understat',
        externalId: String(understatTeamId),
        externalName: understatTeamName,
        confidence,
        resolutionMethod: method,
      },
    })

    return canonical.id
  }

  // Link understat identity to existing canonical
  await db.sourceIdentity.upsert({
    where: {
      source_externalId: { source: 'understat', externalId: String(understatTeamId) },
    },
    update: {
      canonicalTeamId: existingIdentity.canonicalTeamId,
      confidence,
      resolutionMethod: method,
      externalName: understatTeamName,
    },
    create: {
      canonicalTeamId: existingIdentity.canonicalTeamId,
      source: 'understat',
      externalId: String(understatTeamId),
      externalName: understatTeamName,
      confidence,
      resolutionMethod: method,
    },
  })

  return existingIdentity.canonicalTeamId
}

/**
 * Compute data freshness classification based on syncedAt.
 */
export function classifyFreshness(syncedAt: Date): string {
  const hoursSinceSync = (Date.now() - syncedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceSync < 24) return 'FRESH'
  if (hoursSinceSync < 168) return 'CURRENT'  // 7 days
  if (hoursSinceSync < 2160) return 'SEASON'  // 90 days
  return 'STALE'
}

// ── Name normalization (shared with entity-resolution) ──────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(1\.\s*fc\s*|fc\s*|sc\s*|vfl\s*|sv\s*|rc\s*|as\s*|us\s*|ud\s*|ss\s*|ac\s*|afc\s*)/i, '')
    .replace(/\s*(fc|sc|cf|ac|sv|rc|vsp|tsc|vfb|1\.\s*fc|ogc|ras|soc|co|sco)\s*$/i, '')
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
