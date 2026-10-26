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

export async function GET(req: Request) {
  const auth = await authenticateRequest(req)
  if (auth instanceof Response) return auth
  // Configuration values are not secret; authenticated users need to read them so
  // simulations and Kelly calculations use the same effective model settings.
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

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Configuration must be a JSON object' }, { status: 400 })
    }
    const updates = body as Partial<EngineConfig>

    // Reject malformed values rather than coercing strings or persisting invalid flags.
    if (updates.simulationRuns !== undefined) {
      if (typeof updates.simulationRuns !== 'number' || !Number.isInteger(updates.simulationRuns)
        || updates.simulationRuns < 10000 || updates.simulationRuns > 200000) {
        return NextResponse.json({ error: 'simulationRuns must be an integer between 10,000 and 200,000' }, { status: 400 })
      }
    }
    if (updates.kellyFraction !== undefined && (typeof updates.kellyFraction !== 'number'
      || !Number.isFinite(updates.kellyFraction) || updates.kellyFraction < 0.05 || updates.kellyFraction > 1)) {
      return NextResponse.json({ error: 'kellyFraction must be between 0.05 and 1' }, { status: 400 })
    }
    if (updates.minEdgeThreshold !== undefined && (typeof updates.minEdgeThreshold !== 'number'
      || !Number.isFinite(updates.minEdgeThreshold) || updates.minEdgeThreshold < 0.005 || updates.minEdgeThreshold > 0.2)) {
      return NextResponse.json({ error: 'minEdgeThreshold must be between 0.005 and 0.2' }, { status: 400 })
    }
    if (updates.maxBankrollRisk !== undefined && (typeof updates.maxBankrollRisk !== 'number'
      || !Number.isFinite(updates.maxBankrollRisk) || updates.maxBankrollRisk < 0.01 || updates.maxBankrollRisk > 0.25)) {
      return NextResponse.json({ error: 'maxBankrollRisk must be between 0.01 and 0.25' }, { status: 400 })
    }
    for (const key of ['garchEnabled', 'jumpDiffusionEnabled'] as const) {
      if (updates[key] !== undefined && typeof updates[key] !== 'boolean') {
        return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 })
      }
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