import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

/** GET /api/sync — DEPRECATED
 *
 *  This endpoint previously synced ESPN data into local DB tables (Team, Match).
 *  Those tables have been removed as part of the ESPN-live architecture migration.
 *  All match, team, and player data now comes directly from ESPN at request time.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    return NextResponse.json({
      deprecated: true,
      message: 'This sync endpoint is deprecated. Team, Match, Player, MatchEvent, NewsItem, and ApiLog tables have been removed from the database. All match, team, and player data is now fetched live from ESPN at request time. No database sync is needed.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SYNC] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}