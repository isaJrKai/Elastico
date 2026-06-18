import { NextResponse } from 'next/server'

/**
 * GET /api/bandwidth
 *
 * Returns real-time bandwidth usage statistics.
 * This endpoint itself is tiny (< 200 bytes) so it doesn't affect the budget.
 * Called by the Settings page to show data usage stats to the user.
 *
 * Client-side BandwidthTracker accumulates bytes across all fetch() calls.
 * This endpoint provides a server-side echo for the settings page.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    compression: 'elastico-v1',
    features: {
      nullStripping: true,
      keyCompaction: true,
      gzipProxy: true,
      diffUpdates: true,
      serviceWorker: true,
    },
    targets: {
      maxPayloadKB: 5,
      matchPollInterval: 30,
      cacheTTLStatic: 300,
      cacheTTLLive: 10,
    },
  })
}