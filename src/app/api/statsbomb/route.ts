import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  fetchCompetitions, fetchMatches, fetchEvents, fetch360Data, fetchLineups,
  extractShots, extractPasses, aggregateTeamXG, normalizeShotForMap,
  type SBCompetition, type SBMatch, type SBEvent,
} from '@/lib/statsbomb'

/**
 * GET /api/statsbomb
 * Unified endpoint for StatsBomb open data (free, no API key required)
 *
 * Query params:
 *   action=competitions                    — All available competitions/seasons
 *   action=matches&competition=43&season=106  — Matches for a competition/season
 *   action=events&match=3869151            — Full event data for a match
 *   action=shots&match=3869151             — Shot data with xG for a match
 *   action=xg&match=3869151                — Aggregated xG by team
 *   action=passes&match=3869151&team=Argentina — Pass map for a team
 *   action=lineups&match=3869151           — Match lineups
 *   action=360&match=3869151               — 360 freeze-frame data (if available)
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`statsbomb:${ip}`, 20, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'competitions'

    switch (action) {
      // ── Competitions ─────────────────────────────────────────────────────
      case 'competitions': {
        const competitions = await fetchCompetitions()
        // Deduplicate: group by (competition_id, season_id)
        const seen = new Set<string>()
        const unique: SBCompetition[] = []
        for (const c of competitions) {
          const key = `${c.competition_id}-${c.season_id}`
          if (!seen.has(key)) {
            seen.add(key)
            unique.push(c)
          }
        }
        // Group by competition for cleaner frontend consumption
        const grouped: Record<string, { name: string; country: string; gender: string; seasons: { id: number; name: string; has360: boolean }[] }> = {}
        for (const c of unique) {
          const k = String(c.competition_id)
          if (!grouped[k]) {
            grouped[k] = { name: c.competition_name, country: c.country_name, gender: c.competition_gender, seasons: [] }
          }
          grouped[k].seasons.push({
            id: c.season_id,
            name: c.season_name,
            has360: c.match_available_360 !== null,
          })
        }
        return NextResponse.json({
          success: true,
          action,
          totalCompetitions: Object.keys(grouped).length,
          totalSeasons: unique.length,
          data: grouped,
        })
      }

      // ── Matches ──────────────────────────────────────────────────────────
      case 'matches': {
        const competitionId = parseInt(searchParams.get('competition') || '43')
        const seasonId = parseInt(searchParams.get('season') || '106')
        const matches = await fetchMatches(competitionId, seasonId)
        return NextResponse.json({
          success: true,
          action,
          competition: competitionId,
          season: seasonId,
          count: matches.length,
          data: matches.map(m => ({
            id: m.match_id,
            date: m.match_date,
            homeTeam: m.home_team.name,
            awayTeam: m.away_team.name,
            homeScore: m.home_score,
            awayScore: m.away_score,
            status: m.match_status,
            competition: m.competition.name,
            season: m.season.name,
            stadium: m.stadium.name,
            referee: m.referee?.name || null,
          })),
        })
      }

      // ── Full Events ──────────────────────────────────────────────────────
      case 'events': {
        const matchId = parseInt(searchParams.get('match') || '')
        if (!matchId) {
          return NextResponse.json({ success: false, error: 'Missing ?match= param' }, { status: 400 })
        }
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'No events found for this match' }, { status: 404 })
        }
        // Return a summary + full event list
        const types = new Set(events.map(e => e.type?.name).filter(Boolean))
        return NextResponse.json({
          success: true,
          action,
          matchId,
          totalEvents: events.length,
          eventTypes: [...types],
          data: events,
        })
      }

      // ── Shots only ───────────────────────────────────────────────────────
      case 'shots': {
        const matchId = parseInt(searchParams.get('match') || '')
        if (!matchId) {
          return NextResponse.json({ success: false, error: 'Missing ?match= param' }, { status: 400 })
        }
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
        }
        const shots = extractShots(events)
        const teams = [...new Set(events.map(e => e.team?.name).filter(Boolean))]
        const ht = teams[0] || 'Home'
        const at = teams[1] || 'Away'

        const homeShots = shots.filter(s => s.team === ht).map(s => normalizeShotForMap(s, 'home'))
        const awayShots = shots.filter(s => s.team === at).map(s => normalizeShotForMap(s, 'away'))

        return NextResponse.json({
          success: true,
          action,
          matchId,
          homeTeam: ht,
          awayTeam: at,
          homeXg: shots.filter(s => s.team === ht).reduce((sum, s) => sum + s.xg, 0).toFixed(2),
          awayXg: shots.filter(s => s.team === at).reduce((sum, s) => sum + s.xg, 0).toFixed(2),
          totalShots: shots.length,
          data: [...homeShots, ...awayShots],
        })
      }

      // ── xG Aggregation ───────────────────────────────────────────────────
      case 'xg': {
        const matchId = parseInt(searchParams.get('match') || '')
        if (!matchId) {
          return NextResponse.json({ success: false, error: 'Missing ?match= param' }, { status: 400 })
        }
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
        }
        const teams = [...new Set(events.map(e => e.team?.name).filter(Boolean))]
        const ht = teams[0] || 'Home'
        const at = teams[1] || 'Away'
        const xg = aggregateTeamXG(events, ht, at)

        return NextResponse.json({
          success: true,
          action,
          matchId,
          data: {
            home: {
              team: xg.home.team,
              xg: +xg.home.totalXg.toFixed(2),
              shots: xg.home.shots,
              goals: xg.home.goals,
              shotsOnTarget: xg.home.shotsOnTarget,
            },
            away: {
              team: xg.away.team,
              xg: +xg.away.totalXg.toFixed(2),
              shots: xg.away.shots,
              goals: xg.away.goals,
              shotsOnTarget: xg.away.shotsOnTarget,
            },
          },
        })
      }

      // ── Passes ───────────────────────────────────────────────────────────
      case 'passes': {
        const matchId = parseInt(searchParams.get('match') || '')
        if (!matchId) {
          return NextResponse.json({ success: false, error: 'Missing ?match= param' }, { status: 400 })
        }
        const team = searchParams.get('team') // optional filter
        const completedOnly = searchParams.get('incomplete') !== 'true'
        const events = await fetchEvents(matchId)
        if (!events.length) {
          return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
        }
        let passes = extractPasses(events, completedOnly)
        if (team) passes = passes.filter(p => p.team === team)

        return NextResponse.json({
          success: true,
          action,
          matchId,
          team: team || 'all',
          completedOnly,
          count: passes.length,
          data: passes,
        })
      }

      // ── Lineups ──────────────────────────────────────────────────────────
      case 'lineups': {
        const matchId = parseInt(searchParams.get('match') || '')
        if (!matchId) {
          return NextResponse.json({ success: false, error: 'Missing ?match= param' }, { status: 400 })
        }
        const lineups = await fetchLineups(matchId)
        return NextResponse.json({
          success: true,
          action,
          matchId,
          data: lineups,
        })
      }

      // ── 360 Data ─────────────────────────────────────────────────────────
      case '360': {
        const matchId = parseInt(searchParams.get('match') || '')
        if (!matchId) {
          return NextResponse.json({ success: false, error: 'Missing ?match= param' }, { status: 400 })
        }
        const data = await fetch360Data(matchId)
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '360 data not available for this match',
            hint: 'Only select tournaments have 360 freeze-frame data',
          }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          action,
          matchId,
          count: data.length,
          data,
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          validActions: ['competitions', 'matches', 'events', 'shots', 'xg', 'passes', 'lineups', '360'],
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[StatsBomb] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}