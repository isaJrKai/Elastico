import { NextRequest, NextResponse } from 'next/server'
import {
  fetchLeagueTeams, fetchLeaguePlayers, fetchMatch, fetchTeamMatches,
} from '@/lib/understat'

/**
 * GET /api/understat
 * Unified endpoint for Understat xG and shot data
 *
 * Query params:
 *   action=teams&league=PL&season=2024    — League team xG/xGA/PPDA table
 *   action=players&league=PL&season=2024  — League player xG/xA/xGChain leaderboard
 *   action=match&id=14811                  — Match shot map with coordinates + xG
 *   action=team-matches&id=228&season=2024 — Team match history with xG
 *   action=player&id=5021                  — Player detailed stats
 */

export const dynamic = 'force-dynamic'

// Vercel serverless functions have a 10s timeout default.
// Understat scraping can be slow, so we export a longer timeout config.
export const maxDuration = 15

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'teams'

    switch (action) {
      // ── League Teams ─────────────────────────────────────────────────────
      case 'teams': {
        const league = searchParams.get('league') || 'PL'
        const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()))

        const teams = await fetchLeagueTeams(league, season)
        if (!teams.length) {
          return NextResponse.json({
            success: false,
            error: 'No team data found. Check league code and season year.',
            hint: 'Try: ?action=teams&league=PL&season=2023',
          }, { status: 404 })
        }

        // Sort by points descending
        teams.sort((a, b) => b.pts - a.pts)

        return NextResponse.json({
          success: true,
          action,
          league,
          season,
          count: teams.length,
          data: teams.map((t, i) => ({
            position: i + 1,
            id: t.id,
            name: t.title,
            shortName: t.short_title,
            played: t.wins + t.draws + t.losses,
            wins: t.wins,
            draws: t.draws,
            losses: t.losses,
            scored: t.scored,
            missed: t.missed,
            pts: t.pts,
            xG: +t.xG.toFixed(1),
            xGA: +t.xGA.toFixed(1),
            xGD: +(t.xG - t.xGA).toFixed(1),
            npxG: +t.npxG.toFixed(1),
            npxGA: +t.npxGA.toFixed(1),
            xpts: +t.xpts.toFixed(1),
            xptsDiff: +t.xpts_diff.toFixed(1),
            ppda: t.ppda.def ? +(t.ppda.att / t.ppda.def).toFixed(1) : null,
            ppdaAllowed: t.ppda_allowed.def ? +(t.ppda_allowed.att / t.ppda_allowed.def).toFixed(1) : null,
            deep: t.deep,
            deepAllowed: t.deep_allowed,
          })),
        })
      }

      // ── League Players ───────────────────────────────────────────────────
      case 'players': {
        const league = searchParams.get('league') || 'PL'
        const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()))
        const limit = parseInt(searchParams.get('limit') || '50')

        const players = await fetchLeaguePlayers(league, season)
        if (!players.length) {
          return NextResponse.json({
            success: false,
            error: 'No player data found.',
            hint: 'Try: ?action=players&league=PL&season=2023',
          }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          action,
          league,
          season,
          count: players.length,
          data: players.slice(0, limit).map(p => ({
            id: p.id,
            name: p.player_name,
            team: p.team_title,
            position: p.position,
            games: p.games,
            minutes: p.time,
            goals: p.goals,
            xG: +p.xG.toFixed(2),
            assists: p.assists,
            xA: +p.xA.toFixed(2),
            shots: p.shots,
            keyPasses: p.key_passes,
            yellows: p.yellow_cards,
            reds: p.red_cards,
            npg: p.npg,
            npxG: +p.npxG.toFixed(2),
            xGChain: +p.xGChain.toFixed(2),
            xGBuildup: +p.xGBuildup.toFixed(2),
          })),
        })
      }

      // ── Match Detail (Shot Map) ──────────────────────────────────────────
      case 'match': {
        const id = parseInt(searchParams.get('id') || '')
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing ?id= param' }, { status: 400 })
        }

        const match = await fetchMatch(id)
        if (!match) {
          return NextResponse.json({ success: false, error: 'Match not found. Check the Understat match ID.' }, { status: 404 })
        }

        const homeShots = match.shots.h.map(s => normalizeUnderstatShot(s, 'home'))
        const awayShots = match.shots.a.map(s => normalizeUnderstatShot(s, 'away'))

        return NextResponse.json({
          success: true,
          action,
          matchId: id,
          date: match.date,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          score: { home: match.home_goals, away: match.away_goals },
          xg: { home: +match.home_xG.toFixed(2), away: +match.away_xG.toFixed(2) },
          forecast: { homeWin: match.forecast_w * 100, draw: match.forecast_d * 100, awayWin: match.forecast_l * 100 },
          totalShots: homeShots.length + awayShots.length,
          shots: {
            home: homeShots,
            away: awayShots,
          },
        })
      }

      // ── Team Match History ───────────────────────────────────────────────
      case 'team-matches': {
        const id = parseInt(searchParams.get('id') || '')
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing ?id= param' }, { status: 400 })
        }
        const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()))
        const matches = await fetchTeamMatches(id, season)
        return NextResponse.json({
          success: true,
          action,
          teamId: id,
          season,
          count: matches.length,
          data: matches,
        })
      }

      // ── Player Stats ─────────────────────────────────────────────────────
      case 'player': {
        const id = parseInt(searchParams.get('id') || '')
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing ?id= param' }, { status: 400 })
        }
        const stats = await fetchPlayerStats(id)
        if (!stats) {
          return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, action, playerId: id, data: stats })
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          validActions: ['teams', 'players', 'match', 'team-matches', 'player'],
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Understat] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}