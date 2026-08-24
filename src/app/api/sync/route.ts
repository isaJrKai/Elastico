import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    return NextResponse.json({
      status: 'ok',
      message: 'Data flows live from ESPN / API-Sports / PostgreSQL. No bulk sync needed.',
    })
  } catch (error) {
    console.error('[SYNC] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/sync — no-op
 *  Previously triggered a DB sync. Now data is fetched live.
 */
export async function POST() {
  return NextResponse.json({ status: 'ok', message: 'No sync needed — data is fetched live.' })
}