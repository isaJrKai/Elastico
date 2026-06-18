import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET() {
  try {
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
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { name, isEnabled, rollout, description, targetRoles } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'Flag name is required' }, { status: 400 })
    }

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