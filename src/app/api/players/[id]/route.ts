import { NextResponse } from 'next/server'

/**
 * Retired endpoint: this route treated an ID as a player name or team ID and
 * returned ambiguous data. Use /api/players for the supported player listing
 * or /api/live?action=roster for a match roster.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint is retired. Use /api/players or /api/live?action=roster.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
