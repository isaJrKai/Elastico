import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { DEFAULT_CONFIG, type EngineConfig } from '@/lib/prediction-engine'

// In-memory config store (would be database-backed in production)
let currentConfig: EngineConfig = { ...DEFAULT_CONFIG }

// ── GET /api/prediction-engine/config ──────────────────────────────────────────
// Get current engine configuration

export async function GET() {
  return NextResponse.json({
    success: true,
    config: currentConfig,
    defaults: DEFAULT_CONFIG,
  })
}

// ── PATCH /api/prediction-engine/config ────────────────────────────────────────
// Update engine configuration (admin only)

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth || auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Partial<EngineConfig> = body

    // Validate ranges
    if (updates.simulationRuns !== undefined) {
      updates.simulationRuns = Math.min(500000, Math.max(10000, updates.simulationRuns))
    }
    if (updates.kellyFraction !== undefined) {
      updates.kellyFraction = Math.min(1, Math.max(0.05, updates.kellyFraction))
    }
    if (updates.minEdgeThreshold !== undefined) {
      updates.minEdgeThreshold = Math.min(0.2, Math.max(0.005, updates.minEdgeThreshold))
    }
    if (updates.maxBankrollRisk !== undefined) {
      updates.maxBankrollRisk = Math.min(0.25, Math.max(0.01, updates.maxBankrollRisk))
    }

    currentConfig = { ...currentConfig, ...updates }

    return NextResponse.json({
      success: true,
      config: currentConfig,
      message: 'Engine configuration updated',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}