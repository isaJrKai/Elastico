import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { DEFAULT_CONFIG, type EngineConfig } from '@/lib/prediction-engine'

// Config is persisted in the database. Falls back to defaults if not set.
async function getConfig(): Promise<EngineConfig> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'prediction_engine_config' } })
    if (setting?.type === 'json') {
      return { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) }
    }
  } catch { /* fall through to default */ }
  return { ...DEFAULT_CONFIG }
}

async function setConfig(config: EngineConfig): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: 'prediction_engine_config' },
    update: { value: JSON.stringify(config), type: 'json' },
    create: { key: 'prediction_engine_config', value: JSON.stringify(config), type: 'json' },
  })
}

// ── GET /api/prediction-engine/config ──────────────────────────────────────────
// Get current engine configuration

export async function GET() {
  const config = await getConfig()
  return NextResponse.json({
    success: true,
    config,
    defaults: DEFAULT_CONFIG,
  })
}

// ── PATCH /api/prediction-engine/config ────────────────────────────────────────
// Update engine configuration (admin only)

async function handleConfigUpdate(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth; if (auth.user?.role !== 'admin') {
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

    const currentConfig = await getConfig()
    const newConfig = { ...currentConfig, ...updates }
    await setConfig(newConfig)

    return NextResponse.json({
      success: true,
      config: newConfig,
      message: 'Engine configuration updated',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Support both PATCH and PUT for config updates
export async function PATCH(request: Request) { return handleConfigUpdate(request) }
export async function PUT(request: Request) { return handleConfigUpdate(request) }