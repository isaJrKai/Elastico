import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/sync — Returns sync status (auth required)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    const cronSecret = process.env.CRON_SECRET
    const secretConfigured = Boolean(cronSecret && cronSecret.length >= 32)
    return NextResponse.json(
      {
        status: secretConfigured ? 'configured' : 'unconfigured',
        schedulerConfigured: 'unknown',
        message: 'This endpoint checks sync-secret readiness only. Scheduler registration must be verified in the deployment platform.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
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
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required to trigger sync' }, { status: 403 })
    }

    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || cronSecret.length < 32) {
      return NextResponse.json({ error: 'Sync is not configured on this deployment' }, { status: 503 })
    }

    // Import and call the cron sync handler directly
    const cronModule = await import('@/app/api/cron/sync/route')
    const cronGet = cronModule.GET

    // Build a fake NextRequest with the cron secret header
    const req = new NextRequest('http://internal/api/cron/sync', {
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
