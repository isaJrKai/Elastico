import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { DEFAULT_CONFIG, type EngineConfig } from '@/lib/prediction-engine'
import { z } from 'zod'

// Config is persisted in the database. Falls back to defaults if not set.
async function getConfig(): Promise<EngineConfig> {
  const setting = await db.systemSetting.findUnique({ where: { key: 'prediction_engine_config' } })
  if (!setting) return { ...DEFAULT_CONFIG }
  if (setting.type !== 'json') {
    throw new Error('Stored prediction-engine configuration has an invalid type')
  }
  const stored = JSON.parse(setting.value)
  return { ...DEFAULT_CONFIG, ...stored }
}

const ConfigUpdatesSchema = z.object({
  simulationRuns: z.number().int().min(10_000).max(150_000).optional(),
  kellyFraction: z.number().min(0.05).max(1).optional(),
  garchEnabled: z.boolean().optional(),
  jumpDiffusionEnabled: z.boolean().optional(),
  minEdgeThreshold: z.number().min(0).max(0.2).optional(),
  maxBankrollRisk: z.number().min(0.01).max(0.25).optional(),
}).strict()

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
  if (!auth.user || auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = ConfigUpdatesSchema.safeParse(body)
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      return NextResponse.json({ error: 'Invalid or empty engine configuration update' }, { status: 400 })
    }
    const updates: Partial<EngineConfig> = parsed.data

    const currentConfig = await getConfig()
    const newConfig = { ...currentConfig, ...updates }
    await setConfig(newConfig)

    return NextResponse.json({
      success: true,
      config: newConfig,
      message: 'Engine configuration updated',
    })
  } catch (error: unknown) {
    console.error('[Prediction engine config] Update failed')
    return NextResponse.json({ error: 'Failed to update engine configuration' }, { status: 500 })
  }
}

// Support both PATCH and PUT for config updates
export async function PATCH(request: Request) { return handleConfigUpdate(request) }
export async function PUT(request: Request) { return handleConfigUpdate(request) }