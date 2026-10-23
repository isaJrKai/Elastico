import { NextResponse } from 'next/server'

// Demo authentication previously allowed anonymous administrator creation.
// Keep the endpoint closed in every environment until a safe, explicit demo
// identity model is designed and tested.
export async function POST() {
  return NextResponse.json(
    { error: 'Demo authentication is disabled' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}
