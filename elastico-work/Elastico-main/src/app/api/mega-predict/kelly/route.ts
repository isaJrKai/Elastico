import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

const MEGA_API_URL = process.env.MEGA_PREDICT_API_URL || ''
const MEGA_API_KEY = process.env.MEGA_PREDICT_API_KEY || ''
const MEGA_TIMEOUT_MS = 15_000

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  if (!MEGA_API_URL) {
    return NextResponse.json({ error: 'Mega Predict API not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MEGA_TIMEOUT_MS)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (MEGA_API_KEY) headers['X-API-Key'] = MEGA_API_KEY

    const res = await fetch(`${MEGA_API_URL.replace(/\/$/, '')}/api/v1/predictions/kelly`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Backend error')
      return NextResponse.json({ error: `Backend error: ${res.status}`, detail: errText }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, source: 'mega-kelly', data })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Mega Kelly backend timed out' }, { status: 504 })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Mega Kelly error: ${msg}` }, { status: 502 })
  }
}
