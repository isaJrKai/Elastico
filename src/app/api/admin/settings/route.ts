import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    if (auth.user.role !== 'admin') {
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
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { settings } = await req.json()

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ error: 'settings array is required' }, { status: 400 })
    }

    const results = []
    for (const item of settings) {
      if (!item.key || item.value === undefined) continue

      const result = await db.systemSetting.upsert({
        where: { key: item.key },
        update: { value: String(item.value), type: item.type || 'string' },
        create: { key: item.key, value: String(item.value), type: item.type || 'string' },
      })
      results.push(result)
    }

    return NextResponse.json({ settings: results })
  } catch (error) {
    console.error('Admin settings PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}