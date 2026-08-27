import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/sync — Returns sync status (auth required)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    return NextResponse.json({
      status: 'ok',
      message: 'Data syncs from API-Sports/ESPN on schedule. Use POST to trigger immediately.',
    })
  } catch (error) {
    console.error('[SYNC] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/sync — Triggers the actual cron sync pipeline.
 * Re-imports and runs the cron handler directly.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    // Import and call the cron sync handler directly
    const cronModule = await import('@/app/api/cron/sync/route')
    const cronGet = cronModule.GET

    // Build a fake NextRequest with the cron secret header
    const cronSecret = process.env.CRON_SECRET || 'elastico-cron-2024'
    const req = new NextRequest('http://internal/api/sync', {
      headers: { 'x-cron-secret': cronSecret },
    })

    const result = await cronGet(req)
    return result
  } catch (error) {
    console.error('[SYNC/POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
