import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

const MEGA_API_URL = process.env.MEGA_PREDICT_API_URL || ''
const MEGA_API_KEY = process.env.MEGA_PREDICT_API_KEY || ''
const MEGA_TIMEOUT_MS = 15_000

// ── Health check / status ──────────────────────────────────────────────────────

export async function GET() {
  if (!MEGA_API_URL) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'Mega Predict API URL not set. Configure MEGA_PREDICT_API_URL in environment variables.',
      models: [],
    })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (MEGA_API_KEY) headers['X-API-Key'] = MEGA_API_KEY

    const res = await fetch(`${MEGA_API_URL.replace(/\/$/, '')}/api/health`, {
      signal: controller.signal,
      headers,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({
        status: 'unreachable',
        message: `Backend returned ${res.status}`,
        models: [],
      })
    }

    const data = await res.json()
    return NextResponse.json({
      status: 'connected',
      message: 'Mega Predict engine is online',
      backend: data,
      models: [
        'ELO Rating',
        'Poisson',
        'Dixon-Coles',
        'Monte Carlo (150K)',
        'XGBoost',
        'BiLSTM + Attention',
        'Super-Ensemble',
      ],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({
      status: 'error',
      message: msg,
      models: [],
    })
  }
}

// ── Proxy prediction request ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  if (!MEGA_API_URL) {
    return NextResponse.json({
      error: 'Mega Predict API not configured',
      hint: 'Set MEGA_PREDICT_API_URL environment variable to connect to the FastAPI backend.',
    }, { status: 503 })
  }

  try {
    const body = await request.json()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MEGA_TIMEOUT_MS)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (MEGA_API_KEY) headers['X-API-Key'] = MEGA_API_KEY

    const res = await fetch(`${MEGA_API_URL.replace(/\/$/, '')}/api/predictions/predict`, {
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
    return NextResponse.json({
      success: true,
      source: 'mega-ensemble',
      data,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Mega Predict backend timed out' }, { status: 504 })
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Mega Predict error: ${msg}` }, { status: 502 })
  }
}

