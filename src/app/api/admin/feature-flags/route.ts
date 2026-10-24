import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { z } from 'zod'

const FeatureFlagPatchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isEnabled: z.boolean().optional(),
  rollout: z.number().int().min(0).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  targetRoles: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
}).strict()

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    if (!auth.user || auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const flags = await db.featureFlag.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ flags })
  } catch (error) {
    console.error('Feature flags GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = FeatureFlagPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid feature flag payload' }, { status: 400 })
    }
    const { name, isEnabled, rollout, description, targetRoles } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled
    if (rollout !== undefined) updateData.rollout = rollout
    if (description !== undefined) updateData.description = description
    if (targetRoles !== undefined) updateData.targetRoles = JSON.stringify(targetRoles)

    const flag = await db.featureFlag.upsert({
      where: { name },
      update: updateData,
      create: {
        name,
        isEnabled: isEnabled ?? false,
        rollout: rollout ?? 100,
        description: description || null,
        targetRoles: targetRoles ? JSON.stringify(targetRoles) : '[]',
      },
    })

    return NextResponse.json({ flag })
  } catch (error) {
    console.error('Feature flags PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}