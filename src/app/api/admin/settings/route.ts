import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { z } from 'zod'

const AdminSettingsPatchSchema = z.object({
  settings: z.array(z.object({
    key: z.string().trim().min(1).max(100),
    value: z.unknown(),
    type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
  }).strict()).min(1).max(100),
}).strict()

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const settings = await db.systemSetting.findMany({
      orderBy: { key: 'asc' },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Admin settings GET error:', error)
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
    if (Number.isFinite(contentLength) && contentLength > 65_536) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = AdminSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }
    if (parsed.data.settings.some((item) => item.key === 'maintenance_mode')) {
      return NextResponse.json(
        { error: 'Maintenance mode is unavailable until request-layer enforcement is implemented' },
        { status: 501 },
      )
    }

    const results = await db.$transaction(async (tx) => {
      const saved = []
      for (const item of parsed.data.settings) {
        const serializedValue = item.type === 'json' || (item.value !== null && typeof item.value === 'object')
          ? JSON.stringify(item.value)
          : String(item.value)
        if (serializedValue === undefined || serializedValue.length > 10_000) {
          throw new Error('Invalid or oversized setting value')
        }
        const result = await tx.systemSetting.upsert({
          where: { key: item.key },
          update: { value: serializedValue, type: item.type || 'string' },
          create: { key: item.key, value: serializedValue, type: item.type || 'string' },
        })
        saved.push(result)
      }
      return saved
    })

    return NextResponse.json({ settings: results })
  } catch (error) {
    console.error('Admin settings PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}